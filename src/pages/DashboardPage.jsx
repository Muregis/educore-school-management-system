import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { C } from "../lib/theme";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";
import Badge from "../components/Badge";
import Table from "../components/Table";
import { Msg } from "../components/Helpers";

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

    // Borrow activity for last 7 days
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
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {[
            ["Total Books", totalBooks, "#3b82f6"],
            ["Available", availableBooks, "#22c55e"],
            ["Borrowed", borrowedBooks, "#f59e0b"],
            ["Overdue", overdueBooks, "#ef4444"],
            ["Returned This Month", returnedThisMonth, "#8b5cf6"]
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
              <div style={{ color: C.textMuted, fontSize: 12 }}>{label}</div>
              <div style={{ color, fontWeight: 800, fontSize: 24 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>Borrow Activity (Last 7 Days)</div>
            {libraryLoading ? (
              <Msg text="Loading library data..." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
                {borrowActivity.map(({ date, borrowed, returned }) => {
                  const maxCount = Math.max(...borrowActivity.map(d => Math.max(d.borrowed, d.returned)), 1);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.textMuted }}>
                        {new Date(date).getDate()}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                        <div style={{ height: `${Math.max(4, (borrowed / maxCount) * 60)}px`, width: 12, background: "#22c55e", borderRadius: 2 }} />
                        <div style={{ height: `${Math.max(4, (returned / maxCount) * 60)}px`, width: 12, background: "#f59e0b", borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2 }}>
                        {new Date(date).toLocaleDateString('en', { weekday: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, background: "#22c55e", borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: C.textMuted }}>Borrowed</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 12, height: 12, background: "#f59e0b", borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: C.textMuted }}>Returned</span>
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>Overdue Books</div>
            {libraryLoading ? (
              <Msg text="Loading library data..." />
            ) : overdueList.length === 0 ? (
              <div style={{ color: C.textMuted, fontSize: 12, textAlign: "center", padding: 20 }}>
                No overdue books! 🎉
              </div>
            ) : (
              <div style={{ fontSize: 12, maxHeight: 200, overflowY: "auto" }}>
                {overdueList.map(record => (
                  <div key={record.borrow_id} style={{ 
                    padding: "8px 0", 
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: C.text }}>{record.book_title}</div>
                      <div style={{ color: C.textMuted, fontSize: 11 }}>
                        {record.borrower_name} • Due: {new Date(record.due_date).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge text="Overdue" tone="danger" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Define common variables needed for all dashboards
  const boys = students.filter(s => s.gender === "male").length;
  const girls = students.filter(s => s.gender === "female").length;
  const totalStudents = students.length;
  const present = attendance.filter(a => a.status === "present").length;
  const paid = payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

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

  // Admin dashboard
  if (auth?.role === "admin") {
    const pendingPlans = lessonPlansLoading ? "…" : lessonPlans.length;
    const cards = [
      ["Boys", boys],
      ["Girls", girls],
      ["Total Students", totalStudents],
      ["Teachers", teachers.length],
      ["Present Records", present],
      ["Fees Collected", money(paid)],
      ["Outstanding", money(outstanding)],
      ["Pending Plans", pendingPlans],
    ];

    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 12 }}>
          {cards.map(x => (
            <div key={x[0]} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
              <div style={{ color: C.textMuted, fontSize: 12 }}>{x[0]}</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 24 }}>{x[1]}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>Attendance Trend (Last 7 Days)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
              {attendanceByDate.length === 0 ? (
                <div style={{ color: C.textMuted, fontSize: 12 }}>No attendance data yet.</div>
              ) : (
                attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: C.accent, borderRadius: 6, margin: "4px 0" }} />
                      <div style={{ fontSize: 10, color: C.textMuted }}>{date.slice(5)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>Grade Distribution</div>
            {["EE", "ME", "AE", "BE"].map(g => (
              <div key={g} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSub }}>
                  <span>{g}</span>
                  <span>{gradeCount[g]}</span>
                </div>
                <div style={{ height: 8, borderRadius: 20, background: C.surface }}>
                  <div style={{ height: "100%", width: `${Math.min(100, gradeCount[g] * 12)}%`, borderRadius: 20, background: g === "EE" ? C.green : g === "ME" ? C.teal : g === "AE" ? C.amber : C.rose }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: C.text, fontWeight: 700 }}>Pending Lesson Plans</div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>Latest submissions</div>
          </div>
          {lessonPlansLoading ? (
            <Msg text="Loading lesson plans..." />
          ) : lessonPlansError ? (
            <div style={{ color: "#f87171", fontSize: 13, padding: 10 }}>{lessonPlansError}</div>
          ) : lessonPlans.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 13, padding: 10 }}>No pending lesson plans.</div>
          ) : (
            <Table
              headers={["Teacher","Subject","Class","Term / Week","Status","Updated"]}
              rows={lessonPlans.slice(0, 6).map(p => [
                p.teacher_name || "-",
                p.subject,
                p.class_name,
                `${p.term}${p.week ? ` · Wk ${p.week}` : ""}`,
                <Badge key="st" text={p.status} tone={p.status === "pending" ? "warning" : "info"} />,
                new Date(p.updated_at).toLocaleDateString(),
              ])}
            />
          )}
        </div>
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
      ["My Students", myStudents.length],
      ["Classes", myClasses.length],
      ["Present Today", myAttendance.filter(a => a.status === "present").length],
      ["Results Recorded", myResults.length],
    ];

    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {cards.map(x => (
            <div key={x[0]} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
              <div style={{ color: C.textMuted, fontSize: 12 }}>{x[0]}</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 24 }}>{x[1]}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>My Classes Attendance (Last 7 Days)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
              {attendanceByDate.length === 0 ? (
                <div style={{ color: C.textMuted, fontSize: 12 }}>No attendance data yet.</div>
              ) : (
                attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: C.accent, borderRadius: 6, margin: "4px 0" }} />
                      <div style={{ fontSize: 10, color: C.textMuted }}>{date.slice(5)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>My Students Grade Distribution</div>
            {["EE", "ME", "AE", "BE"].map(g => (
              <div key={g} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSub }}>
                  <span>{g}</span>
                  <span>{gradeCount[g]}</span>
                </div>
                <div style={{ height: 8, borderRadius: 20, background: C.surface }}>
                  <div style={{ height: "100%", width: `${Math.min(100, gradeCount[g] * 25)}%`, borderRadius: 20, background: g === "EE" ? C.green : g === "ME" ? C.teal : g === "AE" ? C.amber : C.rose }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: C.text, fontWeight: 700 }}>My Lesson Plans</div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>Recent documents</div>
          </div>
          {lessonPlansLoading ? (
            <Msg text="Loading lesson plans..." />
          ) : lessonPlansError ? (
            <div style={{ color: "#f87171", fontSize: 13, padding: 10 }}>{lessonPlansError}</div>
          ) : lessonPlans.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 13, padding: 10 }}>No lesson plans yet.</div>
          ) : (
            <Table
              headers={["Type","Subject","Class","Status","Updated"]}
              rows={lessonPlans.slice(0, 6).map(p => [
                p.type === "scheme" ? "Scheme" : "Lesson",
                p.subject,
                p.class_name,
                <Badge key="st" text={p.status} tone={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : p.status === "pending" ? "warning" : "info"} />,
                new Date(p.updated_at).toLocaleDateString(),
              ])}
            />
          )}
        </div>
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
      ["Collected This Month", money(collectedThisMonth)],
      ["Total Outstanding", money(outstanding)],
      ["Total Students", students.length],
      ["Payment Records", payments.length],
    ];

    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {cards.map(x => (
            <div key={x[0]} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
              <div style={{ color: C.textMuted, fontSize: 12 }}>{x[0]}</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 24 }}>{x[1]}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>Recent Payments</div>
            <div style={{ fontSize: 12, maxHeight: 200, overflowY: "auto" }}>
              {recentPayments.length === 0 ? (
                <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>No recent payments</div>
              ) : (
                recentPayments.map(p => (
                  <div key={p.id} style={{ 
                    padding: "8px 0", 
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.studentName || `Student ${p.studentId}`}</div>
                      <div style={{ color: C.textMuted }}>{new Date(p.date || p.payment_date).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: "#22c55e" }}>{money(p.amount)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>Outstanding by Class</div>
            <div style={{ fontSize: 12 }}>
              {Object.entries(outstandingByClass).map(([className, amount]) => (
                <div key={className} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span>{className}</span>
                    <span style={{ fontWeight: 600 }}>{money(amount)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.surface }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (amount / outstanding) * 100)}%`, borderRadius: 3, background: "#f59e0b" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
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
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            ["Children", myChildrenStudents.length],
            ["Attendance Rate", `${attendanceRate}%`],
            ["Total Fees", money(totalExpected)],
            ["Balance", money(balance)],
          ].map(x => (
            <div key={x[0]} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
              <div style={{ color: C.textMuted, fontSize: 12 }}>{x[0]}</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 24 }}>{x[1]}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>Child's Attendance Trend (Last 7 Days)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
              {attendanceByDate.length === 0 ? (
                <div style={{ color: C.textMuted, fontSize: 12 }}>No attendance data yet.</div>
              ) : (
                attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: C.accent, borderRadius: 6, margin: "4px 0" }} />
                      <div style={{ fontSize: 10, color: C.textMuted }}>{date.slice(5)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>Recent Grades</div>
            <div style={{ fontSize: 12, maxHeight: 200, overflowY: "auto" }}>
              {myResults.length === 0 ? (
                <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>No grades yet</div>
              ) : (
                myResults
                  .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
                  .slice(0, 5)
                  .map(r => (
                    <div key={r.id} style={{ 
                      padding: "8px 0", 
                      borderBottom: `1px solid ${C.border}`,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.subject}</div>
                        <div style={{ color: C.textMuted }}>{r.marks}/{r.total || r.total_marks}</div>
                      </div>
                      <Badge text={r.grade} tone={r.grade === "EE" ? "success" : r.grade === "ME" ? "info" : r.grade === "AE" ? "warning" : "danger"} />
                    </div>
                  ))
              )}
            </div>
          </div>
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
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            ["Class", myStudentData?.className || "-"],
            ["Attendance Rate", `${attendanceRate}%`],
            ["Total Results", myResults.length],
            ["Present Days", myAttendance.filter(a => a.status === "present").length],
          ].map(x => (
            <div key={x[0]} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
              <div style={{ color: C.textMuted, fontSize: 12 }}>{x[0]}</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 24 }}>{x[1]}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>My Attendance (Last 7 Days)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", alignItems: "end", gap: 8, minHeight: 120 }}>
              {attendanceByDate.length === 0 ? (
                <div style={{ color: C.textMuted, fontSize: 12 }}>No attendance data yet.</div>
              ) : (
                attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: C.accent, borderRadius: 6, margin: "4px 0" }} />
                      <div style={{ fontSize: 10, color: C.textMuted }}>{date.slice(5)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>My Grades by Subject</div>
            <div style={{ fontSize: 12 }}>
              {Object.entries(gradeBySubject).length === 0 ? (
                <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>No grades yet</div>
              ) : (
                Object.entries(gradeBySubject).map(([subject, grade]) => (
                  <div key={subject} style={{ 
                    padding: "8px 0", 
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12
                  }}>
                    <span style={{ fontWeight: 600 }}>{subject}</span>
                    <Badge text={grade} tone={grade === "EE" ? "success" : grade === "ME" ? "info" : grade === "AE" ? "warning" : "danger"} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
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
