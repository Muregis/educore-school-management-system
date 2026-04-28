import { useState, useEffect } from "react";
import FeeBlock from "../components/FeeBlock";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { ALL_CLASSES } from "../lib/constants";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { printHTML } from "../lib/print";

export default function ReportCardsPage({ auth, school, students, canEdit, toast, feeBlocked = false, onGoFees}) {
  const [reportCards, setReportCards] = useState([]);
  const [selected, setSelected]       = useState(null);
  const [fullData, setFullData]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [term, setTerm]               = useState("Term 2");
  const [year, setYear]               = useState("2026");
  const [filterClass, setFilterClass] = useState("all");
  const [form, setForm] = useState({ studentId: "", classTeacherComment: "", principalComment: "", conduct: "Good", daysPresent: "", daysAbsent: "", classPosition: "", outOf: "" });
  const [formClass, setFormClass] = useState("");

  const load = async () => {
    if (!auth?.token) return;
    try {
      const data = await apiFetch(`/reportcards?term=${term}&academicYear=${year}`, { token: auth.token });
      setReportCards(data);
    } catch (e) { toast(e.message, "error"); }
  };

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

  const approveCard = async (reportId, approve) => {
    try {
      await apiFetch(`/reportcards/${reportId}/approve`, {
        method: "PUT",
        body: { approve },
        token: auth.token,
      });
      await load();
      toast(approve ? "Report card approved" : "Approval removed", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const publishCard = async (reportId, publish) => {
    try {
      await apiFetch(`/reportcards/${reportId}/publish`, {
        method: "PUT",
        body: { publish },
        token: auth.token,
      });
      await load();
      toast(publish ? "Report card published" : "Report card unpublished", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const printCard = () => {
    if (!fullData) return;
    const { student, results, attendance, reportCard, average, branding } = fullData;
    const gradeColor = g => g === "A" ? "#22c55e" : g === "B" ? "#3b82f6" : g === "C" ? "#f59e0b" : "#ef4444";

    // Use branding from backend, or fall back to school prop
    const schoolName = branding?.schoolName || school?.name || school?.school_name || "School";
    const logoUrl = branding?.logoUrl || school?.logo_url || "";
    const motto = branding?.schoolMotto || school?.motto || school?.tagline || "";
    const address = branding?.schoolAddress || school?.address || "";
    const phone = branding?.schoolPhone || school?.phone || "";
    const email = branding?.schoolEmail || school?.email || "";

    const hasContact = address || phone || email;

    const html = `
      <div class="print-document">
        <!-- School Header with Branding -->
        <div class="print-header">
          <div class="print-header-content">
            ${logoUrl ? `<div class="print-header-logo"><img src="${logoUrl}" alt="${schoolName} logo" style="max-width:60px;max-height:60px;object-fit:contain;"></div>` : ""}
            <div class="print-header-info ${!logoUrl ? "print-header-info-full" : ""}">
              <h1 class="print-header-school-name">${schoolName}</h1>
              ${motto ? `<p class="print-header-motto">${motto}</p>` : ""}
              ${hasContact ? `
                <div class="print-header-contact">
                  ${address ? `<span>${address}</span>` : ""}
                  ${phone ? `<span>${phone}</span>` : ""}
                  ${email ? `<span>${email}</span>` : ""}
                </div>
              ` : ""}
            </div>
          </div>
          <div class="print-header-title">Academic Report Card — ${term} ${year}</div>
          <div class="print-header-divider"></div>
        </div>

        <!-- Student Info -->
        <div class="info">
          <div class="info-box"><div class="info-label">Student Name</div><strong>${student.full_name}</strong></div>
          <div class="info-box"><div class="info-label">Admission No.</div><strong>${student.admission_number}</strong></div>
          <div class="info-box"><div class="info-label">Class</div><strong>${student.class_name}</strong></div>
          <div class="info-box"><div class="info-label">Average Score</div><strong>${average}%</strong></div>
          ${reportCard?.class_position ? `<div class="info-box"><div class="info-label">Position</div><strong>${reportCard.class_position} / ${reportCard.out_of||'—'}</strong></div>` : ''}
          <div class="info-box"><div class="info-label">Attendance</div><strong>${attendance?.present||0} / ${attendance?.total||0} days</strong></div>
        </div>

        <!-- Results Table -->
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

        <!-- Comments -->
        ${reportCard?.class_teacher_comment ? `<div class="comment"><strong>Class Teacher Comment:</strong> ${reportCard.class_teacher_comment}</div>` : ''}
        ${reportCard?.principal_comment ? `<div class="comment"><strong>Principal Comment:</strong> ${reportCard.principal_comment}</div>` : ''}

        <!-- Signature Section -->
        <div class="signature">
          <div>Class Teacher: ___________________</div>
          <div>Principal: ___________________</div>
          <div>Parent/Guardian: ___________________</div>
        </div>

        <style>
          .print-document{font-family:'Segoe UI',Arial,sans-serif;padding:20px;max-width:210mm;margin:auto;color:#1f2937;background:white}
          .print-header{margin-bottom:20px;width:100%}
          .print-header-content{display:flex;align-items:center;gap:20px;padding-bottom:16px}
          .print-header-logo{flex-shrink:0}
          .print-header-logo img{max-width:60px;max-height:60px;object-fit:contain;border-radius:4px}
          .print-header-info{flex:1;text-align:center}
          .print-header-info-full{text-align:left}
          .print-header-school-name{font-size:20px;font-weight:800;margin:0 0 4px 0;color:#1f2937;line-height:1.2}
          .print-header-motto{font-size:13px;font-style:italic;color:#6b7280;margin:0 0 8px 0}
          .print-header-contact{font-size:10px;color:#6b7280;display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
          .print-header-info-full .print-header-contact{justify-content:flex-start}
          .print-header-title{text-align:center;font-size:14px;font-weight:600;color:#374151;margin:12px 0;text-transform:uppercase;letter-spacing:1px}
          .print-header-divider{height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:12px 0}
          .sub{color:#666;font-size:13px;margin-bottom:20px;text-align:center}
          .info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
          .info-box{background:#f8f8f8;padding:8px 12px;border-radius:6px}
          .info-label{font-size:10px;color:#888;margin-bottom:2px}
          table{width:100%;border-collapse:collapse;margin-bottom:20px}
          th{background:#f0f0f0;text-align:left;padding:8px 10px;font-size:12px}
          td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px}
          .grade{font-weight:bold;padding:2px 8px;border-radius:4px;color:#fff;display:inline-block}
          .comment{background:#f8f8f8;padding:12px;border-radius:6px;margin-bottom:12px;font-size:13px}
          .signature{display:flex;justify-content:space-between;margin-top:40px;font-size:12px;page-break-inside:avoid}
          @media print{
            .print-document{padding:0}
            .print-header-divider{background:#999!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .grade{-webkit-print-color-adjust:exact;print-color-adjust:exact}
            body{background:white!important;color:black!important}
          }
        </style>
      </div>
    `;

    printHTML(html, { title: `Report Card - ${student.full_name}` });
  };


  if (feeBlocked) return <FeeBlock onGoFees={onGoFees} pageName="Report Cards" />;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select style={{ ...inputStyle, width: "auto" }} value={term} onChange={e => setTerm(e.target.value)}>
          <option>Term 1</option><option>Term 2</option><option>Term 3</option>
        </select>
        <select style={{ ...inputStyle, width: "auto" }} value={year} onChange={e => setYear(e.target.value)}>
          <option>2024</option><option>2025</option><option>2026</option>
        </select>
        <select style={{ ...inputStyle, width: "auto" }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="all">All classes</option>
          {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {canEdit && <Btn onClick={() => setShowForm(true)}>+ Add Report Card</Btn>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Students list grouped by class */}
        <div>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>Students by Class</div>
          {(() => {
            const filteredStudents = filterClass === "all" ? students : students.filter(s => (s.className ?? s.class_name) === filterClass);
            const grouped = filteredStudents.reduce((acc, s) => {
              const cls = s.className ?? s.class_name ?? "No Class";
              if (!acc[cls]) acc[cls] = [];
              acc[cls].push(s);
              return acc;
            }, {});
            const classOrderIndex = (className) => {
              const idx = ALL_CLASSES.indexOf(className);
              return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
            };
            const sortedClasses = Object.keys(grouped).sort((a, b) => classOrderIndex(a) - classOrderIndex(b) || a.localeCompare(b));
            return sortedClasses.map(cls => (
              <div key={cls} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: C.accent, fontSize: 13, marginBottom: 6, padding: "4px 8px", background: C.accent + "15", borderRadius: 6 }}>{cls} ({grouped[cls].length})</div>
                {grouped[cls].map(s => {
                  const sid = s.id ?? s.student_id;
                  const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
                  const card = reportCards.find(r => String(r.student_id) === String(sid));
                  return (
                    <div key={sid} onClick={() => viewFull(sid)} style={{ background: selected === sid ? C.accent + "22" : C.card, border: `1px solid ${selected === sid ? C.accent : C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginLeft: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: C.text }}>{name}</div>
                        {card && auth.role === "admin" && (
                          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                            <button onClick={(e) => { e.stopPropagation(); approveCard(card.report_id, !card.is_approved); }} style={{ fontSize: 10, padding: "2px 6px", background: card.is_approved ? "#22c55e" : C.bg, color: card.is_approved ? "#fff" : C.text, border: "1px solid", borderRadius: 4, cursor: "pointer" }}>
                              {card.is_approved ? "Approved" : "Approve"}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); publishCard(card.report_id, !card.is_published); }} style={{ fontSize: 10, padding: "2px 6px", background: card.is_published ? "#3b82f6" : C.bg, color: card.is_published ? "#fff" : C.text, border: "1px solid", borderRadius: 4, cursor: "pointer", opacity: card.is_approved ? 1 : 0.5 }}>
                              {card.is_published ? "Published" : "Publish"}
                            </button>
                          </div>
                        )}
                      </div>
                      <Badge text={card ? (card.is_approved ? "Approved" : "Pending") : "no card"} tone={card ? (card.is_approved ? "success" : "warning") : "danger"} />
                    </div>
                  );
                })}
              </div>
            ));
          })()}
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
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Teacher's Comment</div>
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
            <Field label="Class" style={{ gridColumn: "1 / -1" }}>
              <select style={inputStyle} value={formClass} onChange={e => { setFormClass(e.target.value); setForm({ ...form, studentId: "" }); }}>
                <option value="">-- Select class first --</option>
                {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Student" style={{ gridColumn: "1 / -1" }}>
              <select style={inputStyle} value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} disabled={!formClass}>
                <option value="">{formClass ? "-- Select student --" : "-- Select class first --"}</option>
                {students.filter(s => (s.className ?? s.class_name) === formClass).map(s => { const id = s.id ?? s.student_id; const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`; return <option key={id} value={id}>{name}</option>; })}
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
  school: PropTypes.shape({
    name: PropTypes.string,
    school_name: PropTypes.string,
    logo_url: PropTypes.string,
    motto: PropTypes.string,
    tagline: PropTypes.string,
    address: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
  }),
  students: PropTypes.array.isRequired,
  canEdit: PropTypes.bool.isRequired,
  toast: PropTypes.func.isRequired,
};
