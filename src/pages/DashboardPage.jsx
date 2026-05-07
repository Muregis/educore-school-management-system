import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { Msg } from "../components"; 
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

// Define money here locally just in case it was a global that gets lost in strict module scope
// Premium Stat Card Component
  const StatCard = ({ label, value, color, loading = false }) => (
    <Card style={{ 
      minHeight: 100, 
      position: "relative", 
      overflow: "hidden",
      background: "var(--color-bg-card)",
      border: "1px solid var(--color-border)"
    }}>
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        background: color,
        opacity: 0.8
      }} />
      <div style={{ color: "var(--color-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{label}</div>
      <div style={{ color: "var(--color-text-primary)", fontWeight: 800, fontSize: "26px", marginTop: "var(--space-2)" }}>
        {loading ? <Skeleton width="60px" height="32px" /> : value}
      </div>
    </Card>
  );

  // Premium Chart Card Component  
  const ChartCard = ({ title, children, loading = false }) => (
    <Card>
      <div style={{ color: "var(--color-text-primary)", fontWeight: 700, marginBottom: "var(--space-4)", fontFamily: "var(--font-heading)" }}>{title}</div>
      {loading ? <Skeleton height="180px" /> : children}
    </Card>
  );
// Fallback apiFetch if it was magically global, but better to import it
import { apiFetch } from "../lib/api";

export default function DashboardPage({ auth, school, students, teachers, attendance, payments, feeStructures, results, toast, showFinance = true }) {
  const [books, setBooks] = useState([]);
  const [borrowRecords, setBorrowRecords] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [lessonPlansLoading, setLessonPlansLoading] = useState(false);
  const [lessonPlansError, setLessonPlansError] = useState("");

  // Load library data for librarian
  useEffect(() => {
    if (!(auth?.role === "librarian" && auth?.token)) return;
    const ac = new AbortController();
    setLibraryLoading(true);
    Promise.all([
      apiFetch("/library/books", { token: auth.token, signal: ac.signal }).catch(() => []),
      apiFetch("/library/borrow-records", { token: auth.token, signal: ac.signal }).catch(() => [])
    ]).then(([booksData, borrowsData]) => {
      setBooks(Array.isArray(booksData) ? booksData : []);
      setBorrowRecords(Array.isArray(borrowsData) ? borrowsData : []);
    }).catch(() => {
      // Silent fail for library data
    }).finally(() => {
      setLibraryLoading(false);
    });
    return () => ac.abort();
  }, [auth]);

  // Load lesson plans preview (admin + teacher dashboards)
  useEffect(() => {
    if (!auth?.token) return;
    if (!["admin", "teacher"].includes(auth.role)) return;

    const ac = new AbortController();
    setLessonPlansLoading(true);
    setLessonPlansError("");
    const qs = auth.role === "admin" ? "?status=pending" : "";
    apiFetch(`/lesson-plans${qs}`, { token: auth.token, signal: ac.signal })
      .then(d => setLessonPlans(Array.isArray(d) ? d : []))
      .catch(e => {
        if (e?.code !== "EABORT") {
          setLessonPlans([]);
          setLessonPlansError(e?.message || "Failed to load lesson plans");
        }
      })
      .finally(() => setLessonPlansLoading(false));

    return () => ac.abort();
  }, [auth?.token, auth?.role]);

  // Librarian dashboard
  if (auth?.role === "librarian") {
    const totalBooks = books.reduce((s, b) => s + Number(b.quantity_total || 0), 0);
    const borrowedBooks = books.reduce((s, b) => s + (Number(b.quantity_total || 0) - Number(b.quantity_available || 0)), 0);
    const availableBooks = totalBooks - borrowedBooks;
    const overdueBooks = borrowRecords.filter(b => b.status === "borrowed" && new Date(b.due_date) < new Date()).length;
    const returnedThisMonth = borrowRecords.filter(b => 
      b.status === "returned" && 
      new Date(b.return_date).getMonth() === new Date().getMonth() &&
      new Date(b.return_date).getFullYear() === new Date().getFullYear()
    ).length;

    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().slice(0, 10);
    });
    
    const borrowActivity = last7Days.map(date => ({
      date,
      borrowed: borrowRecords.filter(b => b.borrow_date === date).length,
      returned: borrowRecords.filter(b => b.return_date === date).length,
    }));

    const overdueList = borrowRecords
      .filter(b => b.status === "borrowed" && new Date(b.due_date) < new Date())
      .slice(0, 10);

    return (
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
          {[
            ["Total Books", totalBooks, "var(--color-primary)"],
            ["Available", availableBooks, "var(--color-success)"],
            ["Borrowed", borrowedBooks, "var(--color-warning)"],
            ["Overdue", overdueBooks, "var(--color-danger)"],
            ["Returned This Month", returnedThisMonth, "var(--color-sky)"]
          ].map(([label, value, color]) => (
            <Card key={label} style={{ borderTop: `4px solid ${color}` }}>
              <div style={{ color: "var(--color-text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{label}</div>
              <div style={{ color: "var(--color-text-primary)", fontWeight: 800, fontSize: "32px", marginTop: "var(--space-2)" }}>
                {libraryLoading ? <Skeleton width="60px" height="38px" /> : value}
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          <Card>
            <div style={{ color: "var(--color-text-primary)", fontWeight: 700, marginBottom: "var(--space-4)", fontFamily: "var(--font-heading)" }}>Borrow Activity (Last 7 Days)</div>
            {libraryLoading ? (
              <Skeleton width="100%" height="160px" />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
                {borrowActivity.map(({ date, borrowed, returned }) => {
                  const maxCount = Math.max(...borrowActivity.map(d => Math.max(d.borrowed, d.returned)), 1);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                        {new Date(date).getDate()}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                        <div style={{ height: `${Math.max(4, (borrowed / maxCount) * 60)}px`, width: 12, background: "var(--color-success-muted)", borderRadius: "var(--radius-sm)" }} />
                        <div style={{ height: `${Math.max(4, (returned / maxCount) * 60)}px`, width: "var(--space-3)", background: "var(--color-warning)", borderRadius: "var(--radius-sm)" }} />
                      </div>
                      <div style={{ fontSize: 8, color: "var(--color-text-muted)", marginTop: 2 }}>
                        {new Date(date).toLocaleDateString('en', { weekday: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-4)", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, background: "var(--color-success-muted)", borderRadius: "var(--radius-sm)" }} />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Borrowed</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, background: "var(--color-warning)", borderRadius: "var(--radius-sm)" }} />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Returned</span>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ color: "var(--color-text-primary)", fontWeight: 700, marginBottom: "var(--space-4)", fontFamily: "var(--font-heading)" }}>Overdue Books</div>
            {libraryLoading ? (
              <Skeleton width="100%" height="160px" />
            ) : overdueList.length === 0 ? (
              <EmptyState icon="🎉" title="All clear!" description="No overdue books right now." />
            ) : (
              <div style={{ fontSize: "13px", maxHeight: "250px", overflowY: "auto", paddingRight: "var(--space-2)" }}>
                {overdueList.map(record => (
                  <div key={record.borrow_id} style={{ 
                    padding: "var(--space-3) 0", 
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{record.book_title}</div>
                      <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginTop: "2px" }}>
                        {record.borrower_name} • Due: {new Date(record.due_date).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge text="Overdue" variant="danger" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Define common variables needed for all dashboards
  const boys = students.filter(s => s.gender === "male").length;
  const girls = students.filter(s => s.gender === "female").length;
  const totalStudents = students.length;
  const present = attendance.filter(a => a.status === "present").length;
  
  const today = new Date().toISOString().slice(0, 10);
  const todayPayments = payments.filter(p => {
    const paymentDate = p.date || p.payment_date;
    return p.status === "paid" && paymentDate && paymentDate.startsWith(today);
  });
  const todayCollection = todayPayments.reduce((s, p) => s + Number(p.amount), 0);
  
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  const expectedByClass = cls => {
    const fs = feeStructures.find(f => f.className === cls);
    return fs ? Number(fs.tuition) + Number(fs.activity) + Number(fs.misc) : 0;
  };

  const outstanding = students.reduce((sum, s) => {
    const expected = expectedByClass(s.className);
    const paidByStudent = payments.filter(p => p.studentId === s.id && p.status === "paid").reduce((acc, p) => acc + Number(p.amount), 0);
    return sum + Math.max(0, expected - paidByStudent);
  }, 0);

  const gradeCount = {
    EE: results.filter(r => r.grade === "EE").length,
    ME: results.filter(r => r.grade === "ME").length,
    AE: results.filter(r => r.grade === "AE").length,
    BE: results.filter(r => r.grade === "BE").length,
  };

  const attendanceByDate = Object.entries(
    attendance.reduce((acc, row) => {
      if (!acc[row.date]) acc[row.date] = { present: 0, total: 0 };
      acc[row.date].total += 1;
      if (row.status === "present") acc[row.date].present += 1;
      return acc;
    }, {})
  ).slice(-7);

  // Admin/Secretary dashboard - limited view (receives payments, no outstanding view)
  if (auth?.role === "admin") {
    const cards = [
      ["Boys", boys, "var(--color-primary)"],
      ["Girls", girls, "var(--color-teal)"],
      ["Total Students", totalStudents, "var(--color-success)"],
      ["Teachers", teachers.length, "var(--color-warning)"],
      ["Present Records", present, "var(--color-sky)"],
      ["Today's Collection", money(todayCollection), "var(--color-green)"],
    ];

    return (
      <div className="stagger-in" style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-3)" }}>
          {cards.map(([label, value, accentColor]) => (
            <StatCard key={label} label={label} value={value} color={accentColor} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          <ChartCard title="Attendance Trend (Last 7 Days)">
            {attendanceByDate.length === 0 ? (
              <EmptyState icon="📅" title="No Attendance" description="No attendance data recorded yet." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
                {attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: "var(--color-primary)", borderRadius: "var(--radius-sm)", margin: "4px 0", boxShadow: "var(--shadow-glow)" }} />
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{date.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Grade Distribution">
            {["EE", "ME", "AE", "BE"].map(g => (
              <div key={g} style={{ marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600 }}>{g}</span>
                  <span>{gradeCount[g]}</span>
                </div>
                <div style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--color-bg-hover)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, gradeCount[g] * 12)}%`, borderRadius: "var(--radius-full)", background: g === "EE" ? "var(--color-success)" : g === "ME" ? "var(--color-teal)" : g === "AE" ? "var(--color-warning)" : "var(--color-danger)" }} />
                </div>
              </div>
            ))}
          </ChartCard>
        </div>
      </div>
    );
  }

  // Director/Superadmin dashboard - full management view
  if (["director", "superadmin"].includes(auth?.role)) {
    const pendingPlans = lessonPlansLoading ? "…" : lessonPlans.length;
    const cards = [
      ["Boys", boys, "var(--color-primary)"],
      ["Girls", girls, "var(--color-teal)"],
      ["Total Students", totalStudents, "var(--color-success)"],
      ["Teachers", teachers.length, "var(--color-warning)"],
      ["Present Records", present, "var(--color-sky)"],
      ["Today's Collection", money(todayCollection), "var(--color-green)"],
      ["Total Collection", money(totalPaid), "var(--color-primary)"],
      ["Outstanding", money(outstanding), "var(--color-danger)"],
      ["Pending Plans", pendingPlans, "var(--color-amber)"],
    ];

    return (
      <div className="stagger-in" style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-3)" }}>
          {cards.map(([label, value, accentColor]) => (
            <StatCard key={label} label={label} value={value} color={accentColor} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          <ChartCard title="Attendance Trend (Last 7 Days)">
            {attendanceByDate.length === 0 ? (
              <EmptyState icon="📅" title="No Attendance" description="No attendance data recorded yet." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
                {attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: "var(--color-primary)", borderRadius: "var(--radius-sm)", margin: "4px 0", boxShadow: "var(--shadow-glow)" }} />
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{date.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Grade Distribution">
            {["EE", "ME", "AE", "BE"].map(g => (
              <div key={g} style={{ marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600 }}>{g}</span>
                  <span>{gradeCount[g]}</span>
                </div>
                <div style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--color-bg-hover)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, gradeCount[g] * 12)}%`, borderRadius: "var(--radius-full)", background: g === "EE" ? "var(--color-success)" : g === "ME" ? "var(--color-teal)" : g === "AE" ? "var(--color-warning)" : "var(--color-danger)" }} />
                </div>
              </div>
            ))}
          </ChartCard>
        </div>

        <ChartCard title="Pending Lesson Plans">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600 }}>Latest submissions</div>
          </div>
          {lessonPlansLoading ? (
            <Skeleton height="200px" />
          ) : lessonPlansError ? (
            <div style={{ color: "var(--color-danger)", fontSize: "13px", padding: "var(--space-3)", background: "var(--color-danger-muted)", borderRadius: "var(--radius-md)" }}>{lessonPlansError}</div>
          ) : lessonPlans.length === 0 ? (
            <EmptyState icon="📝" title="All Caught Up" description="No pending lesson plans." />
          ) : (
            <Table
              headers={["Teacher","Subject","Class","Term / Week","Status","Updated"]}
              data={lessonPlans.slice(0, 6).map(p => [
                p.teacher_name || "-",
                p.subject,
                p.class_name,
                `${p.term}${p.week ? ` · Wk ${p.week}` : ""}`,
                <Badge key="st" text={p.status} variant={p.status === "pending" ? "warning" : "info"} />,
                new Date(p.updated_at).toLocaleDateString(),
              ])}
            />
          )}
        </ChartCard>
      </div>
    );
  }

// Teacher dashboard  
  if (auth?.role === "teacher") {
    const myClasses = teachers.find(t => t.email === auth.email)?.classes || [];
    const myStudents = students.filter(s => myClasses.includes(s.className));
    const myAttendance = attendance.filter(a => myStudents.some(s => (s.id ?? s.student_id) === (a.studentId ?? a.student_id)));
    const myResults = results.filter(r => myStudents.some(s => (s.id ?? s.student_id) === (r.studentId ?? r.student_id)));
     
    const attendanceByDate = Object.entries(
      myAttendance.reduce((acc, row) => {
        if (!acc[row.date]) acc[row.date] = { present: 0, total: 0 };
        acc[row.date].total += 1;
        if (row.status === "present") acc[row.date].present += 1;
        return acc;
      }, {})
    ).slice(-7);

    const gradeCount = {
      EE: myResults.filter(r => r.grade === "EE").length,
      ME: myResults.filter(r => r.grade === "ME").length,
      AE: myResults.filter(r => r.grade === "AE").length,
      BE: myResults.filter(r => r.grade === "BE").length,
    };

    const cards = [
      ["My Students", myStudents.length, "var(--color-primary)"],
      ["Classes", myClasses.length, "var(--color-success)"],
      ["Present Today", myAttendance.filter(a => a.status === "present").length, "var(--color-teal)"],
      ["Results Recorded", myResults.length, "var(--color-warning)"],
    ];

    return (
      <div className="stagger-in" style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
          {cards.map(([label, value, accentColor]) => (
            <StatCard key={label} label={label} value={value} color={accentColor} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          <ChartCard title="My Classes Attendance (Last 7 Days)">
            {attendanceByDate.length === 0 ? (
              <EmptyState icon="📅" title="No Attendance" description="No attendance data yet." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
                {attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: "var(--color-primary)", borderRadius: "var(--radius-sm)", margin: "4px 0", boxShadow: "var(--shadow-glow)" }} />
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{date.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>

          <ChartCard title="My Students Grade Distribution">
            {["EE", "ME", "AE", "BE"].map(g => (
              <div key={g} style={{ marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600 }}>{g}</span>
                  <span>{gradeCount[g]}</span>
                </div>
                <div style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--color-bg-hover)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, gradeCount[g] * 25)}%`, borderRadius: "var(--radius-full)", background: g === "EE" ? "var(--color-success)" : g === "ME" ? "var(--color-teal)" : g === "AE" ? "var(--color-warning)" : "var(--color-danger)" }} />
                </div>
              </div>
            ))}
          </ChartCard>
        </div>

        <ChartCard title="My Lesson Plans">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600 }}>Recent documents</div>
          </div>
          {lessonPlansLoading ? (
            <Skeleton height="200px" />
          ) : lessonPlansError ? (
            <div style={{ color: "var(--color-danger)", fontSize: "13px", padding: "var(--space-3)", background: "var(--color-danger-muted)", borderRadius: "var(--radius-md)" }}>{lessonPlansError}</div>
          ) : lessonPlans.length === 0 ? (
            <EmptyState icon="📝" title="No Lesson Plans" description="You haven't submitted any lesson plans yet." />
          ) : (
            <Table
              headers={["Type","Subject","Class","Status","Updated"]}
              data={lessonPlans.slice(0, 6).map(p => [
                p.type === "scheme" ? "Scheme" : "Lesson",
                p.subject,
                p.class_name,
                <Badge key="st" text={p.status} variant={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : p.status === "pending" ? "warning" : "info"} />,
                new Date(p.updated_at).toLocaleDateString(),
              ])}
            />
          )}
        </ChartCard>
      </div>
    );
  }

  // Finance dashboard
  if (auth?.role === "finance") {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const monthlyPayments = payments.filter(p => {
      const paymentDate = new Date(p.date || p.payment_date);
      return paymentDate.getMonth() === thisMonth && paymentDate.getFullYear() === thisYear;
    });
    
    const collectedThisMonth = monthlyPayments.reduce((s, p) => s + Number(p.amount), 0);
    
    const outstandingByClass = students.map(s => {
      const cls = s.className;
      const expected = expectedByClass(cls);
      const paid = payments.filter(p => 
        String(p.studentId) === String(s.id) && p.status === "paid"
      ).reduce((sum, p) => sum + Number(p.amount), 0);
      return { className: cls, outstanding: Math.max(0, expected - paid) };
    }).reduce((acc, item) => {
      acc[item.className] = (acc[item.className] || 0) + item.outstanding;
      return acc;
    }, {});

    const recentPayments = payments
      .filter(p => p.status === "paid")
      .sort((a, b) => new Date(b.date || b.payment_date) - new Date(a.date || a.payment_date))
      .slice(0, 5);

    const cards = [
      ["Today's Collection", money(todayCollection), "var(--color-success)"],
      ["This Month", money(collectedThisMonth), "var(--color-primary)"],
      ["Outstanding", money(outstanding), "var(--color-warning)"],
      ["Students", students.length, "var(--color-sky)"],
    ];

    return (
      <div className="stagger-in" style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
          {cards.map(([label, value, accentColor]) => (
            <StatCard key={label} label={label} value={value} color={accentColor} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          <ChartCard title="Recent Payments">
            <div style={{ fontSize: "13px", maxHeight: "250px", overflowY: "auto", paddingRight: "var(--space-2)" }}>
              {recentPayments.length === 0 ? (
                <EmptyState icon="💰" title="No Payments" description="No recent payments to show." />
              ) : (
                recentPayments.map(p => (
                  <div key={p.id} style={{ 
                    padding: "var(--space-3) 0", 
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{p.studentName || `Student ${p.studentId}`}</div>
                      <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginTop: "2px" }}>{new Date(p.date || p.payment_date).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--color-success)", background: "var(--color-success-muted)", padding: "4px 8px", borderRadius: "var(--radius-full)" }}>{money(p.amount)}</div>
                  </div>
                ))
              )}
            </div>
          </ChartCard>

          <ChartCard title="Outstanding by Class">
            <div style={{ fontSize: "13px" }}>
              {Object.entries(outstandingByClass).map(([className, amount]) => (
                <div key={className} style={{ marginBottom: "var(--space-3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "var(--color-text-secondary)" }}>
                    <span style={{ fontWeight: 600 }}>{className}</span>
                    <span style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{money(amount)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--color-bg-hover)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (amount / (outstanding || 1)) * 100)}%`, borderRadius: "var(--radius-full)", background: "var(--color-warning)" }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>
    );
  }

  // Parent dashboard
  if (auth?.role === "parent") {
    const myChildrenStudents = students.filter(s => {
      const parentPhone = s.parentPhone || s.phone;
      return parentPhone === auth.phone || s.studentId === auth.studentId;
    });

    const myAttendance = attendance.filter(a => 
      myChildrenStudents.some(s => (s.id ?? s.student_id) === (a.studentId ?? a.student_id))
    );
    
    const myResults = results.filter(r => 
      myChildrenStudents.some(s => (s.id ?? s.student_id) === (r.studentId ?? r.student_id))
    );
    
    const myPayments = payments.filter(p => 
      myChildrenStudents.some(s => (s.id ?? s.student_id) === (p.studentId))
    );

    const attendanceRate = myAttendance.length > 0 
      ? Math.round((myAttendance.filter(a => a.status === "present").length / myAttendance.length) * 100)
      : 0;

    const totalPaid = myPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpected = myChildrenStudents.reduce((sum, s) => sum + expectedByClass(s.className), 0);
    const balance = totalExpected - totalPaid;

    const attendanceByDate = Object.entries(
      myAttendance.reduce((acc, row) => {
        if (!acc[row.date]) acc[row.date] = { present: 0, total: 0 };
        acc[row.date].total += 1;
        if (row.status === "present") acc[row.date].present += 1;
        return acc;
      }, {})
    ).slice(-7);

    return (
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
          {[
            ["Children", myChildrenStudents.length, "var(--color-primary)"],
            ["Attendance Rate", `${attendanceRate}%`, "var(--color-success)"],
            ["Total Fees", money(totalExpected), "var(--color-warning)"],
            ["Balance", money(balance), balance > 0 ? "var(--color-danger)" : "var(--color-success)"],
          ].map(([label, value, accentColor]) => (
            <Card key={label} style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: accentColor,
                opacity: 0.8
              }} />
              <div style={{ color: "var(--color-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{label}</div>
              <div style={{ color: "var(--color-text-primary)", fontWeight: 800, fontSize: "28px", marginTop: "var(--space-2)" }}>{value}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          <Card>
            <div style={{ color: "var(--color-text-primary)", fontWeight: 700, marginBottom: "var(--space-4)", fontFamily: "var(--font-heading)" }}>Child's Attendance Trend (Last 7 Days)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
              {attendanceByDate.length === 0 ? (
                <EmptyState icon="📅" title="No Attendance" description="No attendance data yet." />
              ) : (
                attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: "var(--color-primary)", borderRadius: "var(--radius-sm)", margin: "4px 0", boxShadow: "var(--shadow-glow)" }} />
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{date.slice(5)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <div style={{ color: "var(--color-text-primary)", fontWeight: 700, marginBottom: "var(--space-4)", fontFamily: "var(--font-heading)" }}>Recent Grades</div>
            <div style={{ fontSize: "13px", maxHeight: "250px", overflowY: "auto", paddingRight: "var(--space-2)" }}>
              {myResults.length === 0 ? (
                <EmptyState icon="📚" title="No Grades" description="No grades yet." />
              ) : (
                myResults
                  .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
                  .slice(0, 5)
                  .map(r => (
                    <div key={r.id} style={{ 
                      padding: "var(--space-3) 0", 
                      borderBottom: "1px solid var(--color-border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{r.subject}</div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: "11px", marginTop: "2px" }}>{r.marks}/{r.total || r.total_marks}</div>
                      </div>
                      <Badge text={r.grade} variant={r.grade === "EE" ? "success" : r.grade === "ME" ? "info" : r.grade === "AE" ? "warning" : "danger"} />
                    </div>
                  ))
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Student dashboard
  if (auth?.role === "student") {
    const myStudentData = students.find(s => (s.id ?? s.student_id) === auth.studentId);
    const myAttendance = attendance.filter(a => (a.studentId ?? a.student_id) === auth.studentId);
    const myResults = results.filter(r => (r.studentId ?? r.student_id) === auth.studentId);

    const attendanceRate = myAttendance.length > 0 
      ? Math.round((myAttendance.filter(a => a.status === "present").length / myAttendance.length) * 100)
      : 0;

    const attendanceByDate = Object.entries(
      myAttendance.reduce((acc, row) => {
        if (!acc[row.date]) acc[row.date] = { present: 0, total: 0 };
        acc[row.date].total += 1;
        if (row.status === "present") acc[row.date].present += 1;
        return acc;
      }, {})
    ).slice(-7);

    const gradeBySubject = myResults.reduce((acc, r) => {
      acc[r.subject] = r.grade;
      return acc;
    }, {});

    return (
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
          {[
            ["Class", myStudentData?.className || "-", "var(--color-primary)"],
            ["Attendance Rate", `${attendanceRate}%`, "var(--color-success)"],
            ["Total Results", myResults.length, "var(--color-warning)"],
            ["Present Days", myAttendance.filter(a => a.status === "present").length, "var(--color-teal)"],
          ].map(([label, value, accentColor]) => (
            <Card key={label} style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: accentColor,
                opacity: 0.8
              }} />
              <div style={{ color: "var(--color-text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{label}</div>
              <div style={{ color: "var(--color-text-primary)", fontWeight: 800, fontSize: "28px", marginTop: "var(--space-2)" }}>{value}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          <Card>
            <div style={{ color: "var(--color-text-primary)", fontWeight: 700, marginBottom: "var(--space-4)", fontFamily: "var(--font-heading)" }}>My Attendance (Last 7 Days)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
              {attendanceByDate.length === 0 ? (
                <EmptyState icon="📅" title="No Attendance" description="No attendance data yet." />
              ) : (
                attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: "var(--color-primary)", borderRadius: "var(--radius-sm)", margin: "4px 0", boxShadow: "var(--shadow-glow)" }} />
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{date.slice(5)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <div style={{ color: "var(--color-text-primary)", fontWeight: 700, marginBottom: "var(--space-4)", fontFamily: "var(--font-heading)" }}>My Grades by Subject</div>
            <div style={{ fontSize: "13px", maxHeight: "250px", overflowY: "auto", paddingRight: "var(--space-2)" }}>
              {Object.entries(gradeBySubject).length === 0 ? (
                <EmptyState icon="📚" title="No Grades" description="No grades yet." />
              ) : (
                Object.entries(gradeBySubject).map(([subject, grade]) => (
                  <div key={subject} style={{ 
                    padding: "var(--space-3) 0", 
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{subject}</span>
                    <Badge text={grade} variant={grade === "EE" ? "success" : grade === "ME" ? "info" : grade === "AE" ? "warning" : "danger"} />
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Fallback for empty or unrecognized role
  return (
    <div style={{ padding: "var(--space-6)", textAlign: "center" }}>
      <EmptyState icon="👋" title="Welcome to EduCore" description="Please wait while your dashboard is prepared or contact support if this persists." />
    </div>
  );
}

DashboardPage.propTypes = {
  auth: PropTypes.object,
  school: PropTypes.object,
  students: PropTypes.array,
  teachers: PropTypes.array,
  attendance: PropTypes.array,
  payments: PropTypes.array,
  feeStructures: PropTypes.array,
  results: PropTypes.array,
  toast: PropTypes.func.isRequired,
  showFinance: PropTypes.bool,
};
