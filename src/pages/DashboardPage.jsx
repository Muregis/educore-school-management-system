import PropTypes from "prop-types";
import { C } from "../lib/theme";
import { money } from "../lib/utils";

export default function DashboardPage({ students, teachers, attendance, payments, feeStructures, results }) {
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

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 12 }}>
        {[["Boys", boys], ["Girls", girls], ["Total Students", totalStudents], ["Teachers", teachers.length], ["Present Records", present], ["Fees Collected", money(paid)], ["Outstanding", money(outstanding)]].map(x => (
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
    </div>
  );
}

DashboardPage.propTypes = {
  students: PropTypes.array.isRequired,
  teachers: PropTypes.array.isRequired,
  attendance: PropTypes.array.isRequired,
  payments: PropTypes.array.isRequired,
  feeStructures: PropTypes.array.isRequired,
  results: PropTypes.array.isRequired,
};
