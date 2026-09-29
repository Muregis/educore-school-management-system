import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { useCurrentTerm } from "../hooks/useCurrentTerm";
import { Msg } from "../components";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";
import { calculateStudentBalanceLocal } from "../services/studentBalanceUtils";
import { apiFetch } from "../lib/api";
import { formatCurrency, formatCurrencyCompact } from "../lib/expenditure.utils";

const money = (val) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(val || 0);

const ChartCard = ({ title, subtitle, children, loading = false }) => (
  <Card style={{ background: "linear-gradient(145deg, color-mix(in srgb, var(--color-bg-card) 96%, transparent) 0%, var(--color-bg-card) 100%)", boxShadow: "var(--shadow-sm)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
      <div>
        <div style={{ color: "var(--color-text-primary)", fontWeight: 700, fontFamily: "var(--font-heading)", fontSize: "16px" }}>{title}</div>
        {subtitle && <div style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "2px" }}>{subtitle}</div>}
      </div>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary)", boxShadow: "0 0 0 5px color-mix(in srgb, var(--color-primary) 14%, transparent)" }} />
    </div>
    {loading ? <Skeleton height="180px" /> : children}
  </Card>
);

const ProgressRow = ({ label, value, max, color = "var(--color-primary)", displayValue }) => {
  const numericValue = Number(value) || 0;
  const ratio = max > 0 ? Math.min(100, (numericValue / max) * 100) : 0;
  return (
    <div style={{ marginBottom: "var(--space-3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "var(--color-text-secondary)", fontSize: "12px", fontWeight: 700 }}>
        <span>{label}</span>
        <span style={{ color: "var(--color-text-primary)" }}>{displayValue ?? value}</span>
      </div>
      <div style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--color-bg-hover)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${ratio}%`, borderRadius: "var(--radius-full)", background: color, transition: "width 0.25s ease" }} />
      </div>
    </div>
  );
};

export default function DashboardPage({ auth, school, students, teachers, attendance, payments, feeStructures: rawFeeStructures = [], results, toast, showFinance = true }) {
  const { term: currentTerm, startDate, endDate } = useCurrentTerm(auth);
  const feeStructures = Array.isArray(rawFeeStructures)
    ? rawFeeStructures.filter((f) => (f?.term ?? f?.term_name ?? currentTerm) === currentTerm)
    : [];

  const [books, setBooks] = useState([]);
  const [borrowRecords, setBorrowRecords] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [lessonPlansLoading, setLessonPlansLoading] = useState(false);
  const [lessonPlansError, setLessonPlansError] = useState("");
  const [teacherClasses, setTeacherClasses] = useState([]);

  const termResults = currentTerm ? results.filter((r) => (r.term || r.term_name) === currentTerm) : results;
  const termAttendance =
    startDate && endDate
      ? attendance.filter((a) => {
          const d = a.date || a.attendance_date;
          if (!d) return false;
          return d >= startDate && d <= endDate;
        })
      : attendance;

  useEffect(() => {
    if (!(auth?.role === "librarian" && auth?.token)) return;
    const ac = new AbortController();
    setLibraryLoading(true);
    Promise.all([
      apiFetch("/library/books", { token: auth.token, signal: ac.signal }).catch(() => []),
      apiFetch("/library/borrow-records", { token: auth.token, signal: ac.signal }).catch(() => []),
    ])
      .then(([booksData, borrowsData]) => {
        setBooks(Array.isArray(booksData) ? booksData : []);
        setBorrowRecords(Array.isArray(borrowsData) ? borrowsData : []);
      })
      .catch(() => {})
      .finally(() => setLibraryLoading(false));
    return () => ac.abort();
  }, [auth]);

  useEffect(() => {
    if (!auth?.token || !["admin", "teacher"].includes(auth.role)) return;
    const ac = new AbortController();
    setLessonPlansLoading(true);
    setLessonPlansError("");
    const qs = auth.role === "admin" ? "?status=pending" : "";
    apiFetch(`/lesson-plans${qs}`, { token: auth.token, signal: ac.signal })
      .then((d) => setLessonPlans(Array.isArray(d) ? d : []))
      .catch((e) => {
        if (e?.code !== "EABORT") {
          setLessonPlans([]);
          setLessonPlansError(e?.message || "Failed to load lesson plans");
        }
      })
      .finally(() => setLessonPlansLoading(false));
    return () => ac.abort();
  }, [auth?.token, auth?.role]);

  useEffect(() => {
    if (!auth?.token || auth.role !== "teacher") return;
    const ac = new AbortController();
    apiFetch("/teacherassignments/my-classes", { token: auth.token, signal: ac.signal })
      .then((data) => {
        if (!Array.isArray(data)) return setTeacherClasses([]);
        setTeacherClasses(data.map((c) => c.class_name).filter(Boolean));
      })
      .catch(() => setTeacherClasses([]));
    return () => ac.abort();
  }, [auth?.token, auth?.role]);

  const boys = students.filter((s) => s.gender === "male").length;
  const girls = students.filter((s) => s.gender === "female").length;
  const totalStudents = students.length;
  const today = new Date();
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const eatToday = new Date(today.getTime() + eatOffsetMs);
  const todayStr = eatToday.toISOString().slice(0, 10);
  const todayAttendance = attendance.filter((a) => {
    const attendanceDate = a.date;
    if (!attendanceDate) return false;
    const ad = new Date(attendanceDate);
    if (isNaN(ad.getTime())) return false;
    return ad.toISOString().slice(0, 10) === todayStr;
  });
  const present = todayAttendance.filter((a) => a.status === "present").length;
  const todayPayments = payments.filter((p) => {
    const paymentDate = p.date || p.payment_date;
    if (!paymentDate || !["paid", "completed", "success"].includes((p.status || "").toLowerCase())) return false;
    const pd = new Date(paymentDate);
    if (isNaN(pd.getTime())) return false;
    if (currentTerm && (p.term || p.term_name) && (p.term || p.term_name) !== currentTerm) return false;
    return pd.toISOString().slice(0, 10) === todayStr;
  });
  const todayCollection = todayPayments.reduce((s, p) => s + Number(p.amount), 0);
  const studentBalances = students.map((student) => ({
    student,
    ...calculateStudentBalanceLocal({ student, feeStructures, payments }),
  }));
  const totalPaid = studentBalances.reduce((sum, item) => sum + item.paid, 0);
  const outstanding = studentBalances.reduce((sum, item) => sum + item.balance, 0);
  const gradeCount = {
    EE: termResults.filter((r) => r.grade === "EE").length,
    ME: termResults.filter((r) => r.grade === "ME").length,
    AE: termResults.filter((r) => r.grade === "AE").length,
    BE: termResults.filter((r) => r.grade === "BE").length,
  };
  const attendanceByDate = Object.entries(
    termAttendance.reduce((acc, row) => {
      const d = row.date || row.attendance_date;
      if (!d) return acc;
      if (!acc[d]) acc[d] = { present: 0, total: 0 };
      acc[d].total += 1;
      if (row.status === "present") acc[d].present += 1;
      return acc;
    }, {})
  ).slice(-7);

  // Director / superadmin
  if (["director", "superadmin"].includes(auth?.role)) {
    const pendingPlans = lessonPlansLoading ? "…" : lessonPlans.length;
    const cards = [
      ["Boys", boys, "var(--color-primary)"],
      ["Girls", girls, "var(--color-teal)"],
      ["Total Students", totalStudents, "var(--color-success)"],
      ["Teachers", teachers.length, "var(--color-warning)"],
      ["Present Records", present, "var(--color-sky)"],
      ["Today's Collection", formatCurrencyCompact(todayCollection), "var(--color-green)", formatCurrency(todayCollection)],
      ["Total Collection", formatCurrencyCompact(totalPaid), "var(--color-primary)", formatCurrency(totalPaid)],
      ["Outstanding", formatCurrencyCompact(outstanding), "var(--color-danger)", formatCurrency(outstanding)],
      ["Pending Plans", pendingPlans, "var(--color-text-muted)"],
    ];
    return (
      <div className="stagger-in" style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "var(--space-3)" }}>
          {cards.map(([label, value, accentColor, title]) => (
            <StatCard key={label} label={label} value={value} color={accentColor} title={title} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "var(--space-3)", alignItems: "start" }}>
          <ChartCard title="Attendance Trend (Last 7 Days)">
            {attendanceByDate.length === 0 ? (
              <EmptyState icon="📅" title="No Attendance" description="No attendance data recorded yet." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", alignItems: "end", gap: 8, minHeight: 120 }}>
                {attendanceByDate.map(([date, values]) => {
                  const pct = values.total === 0 ? 0 : Math.round((values.present / values.total) * 100);
                  return (
                    <div key={date} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{pct}%</div>
                      <div style={{ height: `${Math.max(8, pct)}px`, background: "var(--color-primary)", borderRadius: "var(--radius-sm)" }} />
                      <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{String(date).slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>
          <ChartCard title="Grade Distribution" subtitle="Current performance split">
            {["EE", "ME", "AE", "BE"].map((g) => (
              <ProgressRow
                key={g}
                label={g}
                value={gradeCount[g]}
                max={Math.max(...Object.values(gradeCount), 1)}
                color={g === "EE" ? "var(--color-success)" : g === "ME" ? "var(--color-teal)" : g === "AE" ? "var(--color-warning)" : "var(--color-danger)"}
              />
            ))}
          </ChartCard>
        </div>
        <ChartCard title="Pending Lesson Plans" subtitle="Latest submissions">
          {lessonPlansLoading ? (
            <Skeleton height="120px" />
          ) : lessonPlans.length === 0 ? (
            <EmptyState icon="📝" title="All Caught Up" description={lessonPlansError || "No pending lesson plans."} />
          ) : (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {lessonPlans.slice(0, 5).map((plan) => (
                <div key={plan.id || plan.plan_id || plan.title} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border)" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{plan.title || plan.subject || "Lesson plan"}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{plan.teacher_name || plan.class_name || ""}</div>
                  </div>
                  <Badge text={plan.status || "pending"} variant="warning" />
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    );
  }

  // Default / other roles — compact overview
  const cards = [
    ["Boys", boys, "var(--color-primary)"],
    ["Girls", girls, "var(--color-teal)"],
    ["Total Students", totalStudents, "var(--color-success)"],
    ["Teachers", teachers.length, "var(--color-warning)"],
    ["Present Records", present, "var(--color-sky)"],
    ["Today's Collection", formatCurrencyCompact(todayCollection), "var(--color-green)", formatCurrency(todayCollection)],
    ["Total Collection", formatCurrencyCompact(totalPaid), "var(--color-primary)", formatCurrency(totalPaid)],
    ["Outstanding", formatCurrencyCompact(outstanding), "var(--color-danger)", formatCurrency(outstanding)],
  ];

  return (
    <div className="stagger-in" style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "var(--space-3)" }}>
        {cards.map(([label, value, accentColor, title]) => (
          <StatCard key={label} label={label} value={value} color={accentColor} title={title} />
        ))}
      </div>
      <EmptyState icon="👋" title="Welcome" description="Your role dashboard is ready. Use the menu to open Students, Fees, Attendance, and more." />
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
