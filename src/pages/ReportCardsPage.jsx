import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";

export default function ReportCardsPage({ auth, students, canEdit, toast }) {
  const [reportCards, setReportCards] = useState([]);
  const [selected, setSelected]       = useState(null);
  const [fullData, setFullData]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [term, setTerm]               = useState("Term 2");
  const [year, setYear]               = useState("2026");
  const [form, setForm] = useState({ studentId: "", classTeacherComment: "", principalComment: "", conduct: "Good", daysPresent: "", daysAbsent: "", classPosition: "", outOf: "" });

  const load = async () => {
    if (!auth?.token) return;
    try {
      const data = await apiFetch(`/reportcards?term=${term}&academicYear=${year}`, { token: auth.token });
      setReportCards(data);
    } catch (e) { toast(e.message, "error"); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [auth, term, year]);

  const viewFull = async (studentId) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/reportcards/${studentId}/full?term=${term}&academicYear=${year}`, { token: auth.token });
      setFullData(data);
      setSelected(studentId);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const save = async () => {
    if (!form.studentId) return toast("Select a student", "error");
    try {
      await apiFetch("/reportcards", {
        method: "POST",
        body: { ...form, studentId: Number(form.studentId), term, academicYear: year, daysPresent: Number(form.daysPresent)||0, daysAbsent: Number(form.daysAbsent)||0, classPosition: Number(form.classPosition)||null, outOf: Number(form.outOf)||null },
        token: auth.token,
      });
      await load(); setShowForm(false); toast("Report card saved", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const printCard = () => {
    if (!fullData) return;
    const { student, results, attendance, reportCard, average } = fullData;
    const gradeColor = g => g === "A" ? "#22c55e" : g === "B" ? "#3b82f6" : g === "C" ? "#f59e0b" : "#ef4444";
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>Report Card - ${student.full_name}</title>
      <style>
        body{font-family:sans-serif;padding:40px;max-width:600px;margin:auto;color:#111}
        h1{font-size:22px;margin-bottom:2px}.sub{color:#666;font-size:13px;margin-bottom:20px}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
        .info-box{background:#f8f8f8;padding:8px 12px;border-radius:6px}
        .info-label{font-size:10px;color:#888;margin-bottom:2px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th{background:#f0f0f0;text-align:left;padding:8px 10px;font-size:12px}
        td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px}
        .grade{font-weight:bold;padding:2px 8px;border-radius:4px;color:#fff;display:inline-block}
        .comment{background:#f8f8f8;padding:12px;border-radius:6px;margin-bottom:12px;font-size:13px}
        .signature{display:flex;justify-content:space-between;margin-top:40px;font-size:12px}
        @media print{button{display:none}}
      </style></head><body>
        <h1>Greenfield Academy</h1>
        <div class="sub">Academic Report Card — ${term} ${year}</div>
        <div class="info">
          <div class="info-box"><div class="info-label">Student Name</div><strong>${student.full_name}</strong></div>
          <div class="info-box"><div class="info-label">Admission No.</div><strong>${student.admission_number}</strong></div>
          <div class="info-box"><div class="info-label">Class</div><strong>${student.class_name}</strong></div>
          <div class="info-box"><div class="info-label">Average Score</div><strong>${average}%</strong></div>
          ${reportCard?.class_position ? `<div class="info-box"><div class="info-label">Position</div><strong>${reportCard.class_position} / ${reportCard.out_of||'—'}</strong></div>` : ''}
          <div class="info-box"><div class="info-label">Attendance</div><strong>${attendance?.present||0} / ${attendance?.total||0} days</strong></div>
        </div>
        <table>
          <thead><tr><th>Subject</th><th>Score</th><th>Grade</th><th>Remarks</th></tr></thead>
          <tbody>${results.map(r => `
            <tr>
              <td>${r.subject}</td>
              <td>${r.marks}</td>
              <td><span class="grade" style="background:${gradeColor(r.grade)}">${r.grade}</span></td>
              <td style="color:#666;font-size:12px">${r.teacher_comment||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${reportCard?.class_teacher_comment ? `<div class="comment"><strong>Class Teacher:</strong> ${reportCard.class_teacher_comment}</div>` : ''}
        ${reportCard?.principal_comment ? `<div class="comment"><strong>Principal:</strong> ${reportCard.principal_comment}</div>` : ''}
        <div class="signature">
          <div>Class Teacher: ___________________</div>
          <div>Principal: ___________________</div>
          <div>Parent/Guardian: ___________________</div>
        </div>
        <button onclick="window.print()" style="margin-top:24px;padding:8px 20px;cursor:pointer">Print Report Card</button>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select style={{ ...inputStyle, width: "auto" }} value={term} onChange={e => setTerm(e.target.value)}>
          <option>Term 1</option><option>Term 2</option><option>Term 3</option>
        </select>
        <select style={{ ...inputStyle, width: "auto" }} value={year} onChange={e => setYear(e.target.value)}>
          <option>2024</option><option>2025</option><option>2026</option>
        </select>
        {canEdit && <Btn onClick={() => setShowForm(true)}>+ Add Report Card</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Students list */}
        <div>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>Students ({students.length})</div>
          {students.map(s => {
            const sid = s.id ?? s.student_id;
            const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
            const cls = s.className ?? s.class_name ?? "";
            const hasCard = reportCards.some(r => String(r.student_id) === String(sid));
            return (
              <div key={sid} onClick={() => viewFull(sid)} style={{ background: selected === sid ? C.accent + "22" : C.card, border: `1px solid ${selected === sid ? C.accent : C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, color: C.text }}>{name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{cls}</div>
                </div>
                <Badge text={hasCard ? "card ready" : "no card"} tone={hasCard ? "success" : "warning"} />
              </div>
            );
          })}
        </div>

        {/* Report card preview */}
        <div>
          {loading && <div style={{ color: C.textMuted, padding: 24 }}>Loading...</div>}
          {fullData && !loading && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>{fullData.student.full_name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{fullData.student.class_name} · {term} {year}</div>
                </div>
                <Btn onClick={printCard}>🖨 Print</Btn>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[["Average", `${fullData.average}%`], ["Present", `${fullData.attendance?.present||0} days`], ["Absent", `${fullData.attendance?.absent||0} days`], ["Position", fullData.reportCard?.class_position ? `${fullData.reportCard.class_position}/${fullData.reportCard.out_of||'—'}` : "—"]].map(([l,v]) => (
                  <div key={l} style={{ background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{l}</div>
                    <div style={{ fontWeight: 700, color: C.text }}>{v}</div>
                  </div>
                ))}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                <thead><tr>{["Subject","Score","Grade"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted }}>{h}</th>)}</tr></thead>
                <tbody>
                  {fullData.results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 8px", color: C.text, fontSize: 13 }}>{r.subject}</td>
                      <td style={{ padding: "6px 8px", color: C.text, fontWeight: 600 }}>{r.marks}</td>
                      <td style={{ padding: "6px 8px" }}><Badge text={r.grade} tone={r.grade==="A"?"success":r.grade==="B"?"info":r.grade==="C"?"warning":"danger"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {fullData.reportCard?.class_teacher_comment && (
                <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Teacher&apos;s Comment</div>
                  <div style={{ color: C.textSub, fontSize: 13 }}>{fullData.reportCard.class_teacher_comment}</div>
                </div>
              )}
            </div>
          )}
          {!fullData && !loading && (
            <div style={{ color: C.textMuted, padding: 24, textAlign: "center" }}>Select a student to view their report card</div>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title="Add Report Card" onClose={() => setShowForm(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Student" style={{ gridColumn: "1 / -1" }}>
              <select style={inputStyle} value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                <option value="">-- Select student --</option>
                {students.map(s => { const id = s.id ?? s.student_id; const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`; return <option key={id} value={id}>{name}</option>; })}
              </select>
            </Field>
            <Field label="Days Present"><input type="number" style={inputStyle} value={form.daysPresent} onChange={e => setForm({ ...form, daysPresent: e.target.value })} /></Field>
            <Field label="Days Absent"><input type="number" style={inputStyle} value={form.daysAbsent} onChange={e => setForm({ ...form, daysAbsent: e.target.value })} /></Field>
            <Field label="Class Position"><input type="number" style={inputStyle} value={form.classPosition} onChange={e => setForm({ ...form, classPosition: e.target.value })} /></Field>
            <Field label="Out Of"><input type="number" style={inputStyle} value={form.outOf} onChange={e => setForm({ ...form, outOf: e.target.value })} /></Field>
            <Field label="Conduct">
              <select style={inputStyle} value={form.conduct} onChange={e => setForm({ ...form, conduct: e.target.value })}>
                <option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
              </select>
            </Field>
            <Field label="Class Teacher Comment" style={{ gridColumn: "1 / -1" }}>
              <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={form.classTeacherComment} onChange={e => setForm({ ...form, classTeacherComment: e.target.value })} />
            </Field>
            <Field label="Principal Comment" style={{ gridColumn: "1 / -1" }}>
              <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={form.principalComment} onChange={e => setForm({ ...form, principalComment: e.target.value })} />
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn onClick={save}>Save Report Card</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

ReportCardsPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array.isRequired,
  canEdit: PropTypes.bool.isRequired,
  toast: PropTypes.func.isRequired,
};
