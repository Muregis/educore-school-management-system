import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES } from "../lib/constants";

const card = (label, value, tone = "default") => {
  const colors = { success: "#4ade80", warning: "#facc15", danger: "#f87171", info: "#60a5fa", default: C.accent };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", minWidth: 160 }}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: colors[tone] }}>{value}</div>
    </div>
  );
};

export default function ReportsPage({ auth }) {
  const [summary, setSummary]   = useState(null);
  const [monthly, setMonthly]   = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [grades, setGrades]     = useState([]);
  const [tab, setTab]           = useState("overview");
  const [filterClass, setFilterClass] = useState("all");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!auth?.token) { setLoading(false); return; }
    Promise.all([
      apiFetch("/reports/summary",               { token: auth.token }),
      apiFetch("/reports/monthly-fee-collection", { token: auth.token }),
      apiFetch("/reports/attendance-rate",        { token: auth.token }),
      apiFetch("/reports/fee-defaulters",         { token: auth.token }),
      apiFetch("/reports/grade-distribution",     { token: auth.token }),
    ]).then(([s, m, a, d, g]) => {
      // Normalise backend key names to what the UI expects
      const normSummary = s ? {
        students:       s.totalStudents   ?? s.students       ?? 0,
        teachers:       s.totalTeachers   ?? s.teachers       ?? 0,
        feesCollected:  s.totalCollected  ?? s.feesCollected  ?? 0,
        feesPending:    s.totalPending    ?? s.feesPending    ?? 0,
        openDiscipline: s.openDiscipline  ?? 0,
      } : null;
      setSummary(normSummary);
      // Normalise monthly: backend returns "collected", UI uses "total"
      setMonthly((m || []).map(row => ({ ...row, total: row.total ?? row.collected ?? 0 })));
      setAttendance(a); setDefaulters(d);
      // grade-distribution may return avgScore -- normalise to avg_score
      setGrades((g || []).map(row => ({
        ...row,
        avg_score:  row.avg_score  ?? row.avgScore  ?? 0,
        class_name: row.class_name ?? row.subject   ?? "",
      })));
    }).catch(e => {
      toast("Failed to load reports data", "error");
      console.error("Reports load error:", e);
    }).finally(() => setLoading(false));
  }, [auth]);

  const tabBtn = id => (
    <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 14px", border: "none", borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`, background: "transparent", color: tab === id ? C.accent : C.textMuted, cursor: "pointer", fontWeight: tab === id ? 700 : 400, fontSize: 13 }}>
      {id.charAt(0).toUpperCase() + id.slice(1)}
    </button>
  );

  const filteredGrades     = filterClass === "all" ? grades     : grades.filter(g => g.class_name === filterClass);
  const filteredDefaulters = filterClass === "all" ? defaulters : defaulters.filter(d => d.class_name === filterClass);

  if (loading) return <div style={{ color: C.textMuted, padding: 32 }}>Loading reports…</div>;

  return (
    <div>
      {/* Summary cards */}
      {summary && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {card("Active Students",    summary.students,                       "info")}
          {card("Active Teachers",    summary.teachers,                       "info")}
          {card("Fees Collected",     money(summary.feesCollected),           "success")}
          {card("Fees Pending",       money(summary.feesPending),             "warning")}
          {card("Open Discipline",    summary.openDiscipline,                 "danger")}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        {["overview","fees","attendance","grades","defaulters"].map(tabBtn)}
      </div>

      {/* Class filter */}
      {["grades","defaulters"].includes(tab) && (
        <select style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", marginBottom: 12, fontSize: 13 }}
          value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="all">All classes</option>
          {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
      )}

      {tab === "overview" && (
        <div>
          <h3 style={{ color: C.text, marginBottom: 8 }}>Monthly Fee Collection</h3>
          {monthly.length === 0 ? <p style={{ color: C.textMuted }}>No payment data yet.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Month","Transactions","Total"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12 }}>{h}</th>)}</tr></thead>
                <tbody>{monthly.map((m, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", color: C.text }}>{m.month}</td>
                    <td style={{ padding: "8px 10px", color: C.textSub }}>{m.transactions}</td>
                    <td style={{ padding: "8px 10px", color: "#4ade80", fontWeight: 700 }}>{money(m.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "fees" && (
        <div>
          <h3 style={{ color: C.text, marginBottom: 8 }}>Monthly Fee Collection</h3>
          {monthly.length === 0 ? <p style={{ color: C.textMuted }}>No payment data yet.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {monthly.map((m, i) => {
                const max = Math.max(...monthly.map(x => Number(x.total)));
                const pct = max > 0 ? (Number(m.total) / max) * 100 : 0;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 70, fontSize: 12, color: C.textMuted }}>{m.month}</div>
                    <div style={{ flex: 1, background: C.border, borderRadius: 6, height: 20, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, background: C.accent, height: "100%", borderRadius: 6, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ width: 100, fontSize: 12, color: C.text, textAlign: "right" }}>{money(m.total)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div>
          <h3 style={{ color: C.text, marginBottom: 8 }}>Attendance Rate by Class</h3>
          {attendance.length === 0 ? <p style={{ color: C.textMuted }}>No attendance data yet.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Class","Total Records","Present","Rate"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12 }}>{h}</th>)}</tr></thead>
                <tbody>{attendance.map((a, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", color: C.text, fontWeight: 600 }}>{a.class_name}</td>
                    <td style={{ padding: "8px 10px", color: C.textSub }}>{a.total}</td>
                    <td style={{ padding: "8px 10px", color: C.textSub }}>{a.present}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ color: Number(a.rate) >= 80 ? "#4ade80" : Number(a.rate) >= 60 ? "#facc15" : "#f87171", fontWeight: 700 }}>{a.rate}%</span>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "grades" && (
        <div>
          <h3 style={{ color: C.text, marginBottom: 8 }}>Grade Averages by Subject</h3>
          {filteredGrades.length === 0 ? <p style={{ color: C.textMuted }}>No grade data yet.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Class","Subject","Average","Highest","Lowest","Entries"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12 }}>{h}</th>)}</tr></thead>
                <tbody>{filteredGrades.map((g, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", color: C.text }}>{g.class_name}</td>
                    <td style={{ padding: "8px 10px", color: C.textSub }}>{g.subject}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: Number(g.avg_score) >= 70 ? "#4ade80" : Number(g.avg_score) >= 50 ? "#facc15" : "#f87171" }}>{g.avg_score}</td>
                    <td style={{ padding: "8px 10px", color: "#4ade80" }}>{g.highest}</td>
                    <td style={{ padding: "8px 10px", color: "#f87171" }}>{g.lowest}</td>
                    <td style={{ padding: "8px 10px", color: C.textMuted }}>{g.entries}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "defaulters" && (
        <div>
          <h3 style={{ color: C.text, marginBottom: 8 }}>Fee Defaulters</h3>
          {filteredDefaulters.length === 0 ? <p style={{ color: C.textMuted, }}>No defaulters — all fees cleared! 🎉</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Student","Class","Admission","Phone","Expected","Paid","Balance"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12 }}>{h}</th>)}</tr></thead>
                <tbody>{filteredDefaulters.map((d, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", color: C.text, fontWeight: 600 }}>{d.first_name} {d.last_name}</td>
                    <td style={{ padding: "8px 10px", color: C.textSub }}>{d.class_name}</td>
                    <td style={{ padding: "8px 10px", color: C.textMuted, fontSize: 12 }}>{d.admission_number}</td>
                    <td style={{ padding: "8px 10px", color: C.textMuted, fontSize: 12 }}>{d.parent_phone}</td>
                    <td style={{ padding: "8px 10px", color: C.textSub }}>{money(d.expected)}</td>
                    <td style={{ padding: "8px 10px", color: "#4ade80" }}>{money(d.paid)}</td>
                    <td style={{ padding: "8px 10px", color: "#f87171", fontWeight: 700 }}>{money(d.balance)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ReportsPage.propTypes = { auth: PropTypes.object };
