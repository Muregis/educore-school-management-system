import React, { useState, useEffect } from "react";
import FeeBlock from "../components/FeeBlock";
import PropTypes from "prop-types";
import { ALL_CLASSES } from "../lib/constants";
import { apiFetch } from "../lib/api";
import { printHTML } from "../lib/print";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";

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

    const schoolName = branding?.schoolName || school?.name || school?.school_name || "School";
    const logoUrl = branding?.logoUrl || school?.logo_url || "";
    const motto = branding?.schoolMotto || school?.motto || school?.tagline || "";
    const address = branding?.schoolAddress || school?.address || "";
    const phone = branding?.schoolPhone || school?.phone || "";
    const email = branding?.schoolEmail || school?.email || "";

    const hasContact = address || phone || email;

    const html = `
      <div class="print-document">
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

        ${reportCard?.class_teacher_comment ? `<div class="comment"><strong>Class Teacher Comment:</strong> ${reportCard.class_teacher_comment}</div>` : ''}
        ${reportCard?.principal_comment ? `<div class="comment"><strong>Principal Comment:</strong> ${reportCard.principal_comment}</div>` : ''}

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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Filters Container */}
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
          <Select 
            value={term} 
            onChange={e => setTerm(e.target.value)}
            options={["Term 1", "Term 2", "Term 3"].map(t => ({ value: t, label: t }))}
          />
          <Select 
            value={year} 
            onChange={e => setYear(e.target.value)}
            options={["2024", "2025", "2026"].map(y => ({ value: y, label: y }))}
          />
          <Select 
            value={filterClass} 
            onChange={e => setFilterClass(e.target.value)}
            options={[
              { value: "all", label: "All classes" },
              ...ALL_CLASSES.map(c => ({ value: c, label: c }))
            ]}
          />
          <div style={{ marginLeft: "auto" }}>
            {canEdit && <Button onClick={() => setShowForm(true)}>+ Add Report Card</Button>}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", alignItems: "start" }}>
        {/* Students list grouped by class */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "16px" }}>Students by Class</div>
          {(() => {
            const filteredStudents = filterClass === "all" ? students : students.filter(s => (s.className ?? s.class_name) === filterClass);
            
            if (filteredStudents.length === 0) {
              return <EmptyState icon="👨‍🎓" title="No Students" description="No students found matching your filters." />;
            }
            
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
              <div key={cls}>
                <div style={{ fontWeight: 600, color: "var(--color-primary)", fontSize: "13px", marginBottom: "var(--space-2)", padding: "4px 8px", background: "var(--color-primary-muted)", borderRadius: "var(--radius-md)", display: "inline-block" }}>
                  {cls} ({grouped[cls].length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginLeft: "var(--space-2)" }}>
                  {grouped[cls].map(s => {
                    const sid = s.id ?? s.student_id;
                    const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
                    const card = reportCards.find(r => String(r.student_id) === String(sid));
                    const isSelected = selected === sid;
                    
                    return (
                      <div 
                        key={sid} 
                        onClick={() => viewFull(sid)} 
                        style={{ 
                          background: isSelected ? "var(--color-primary-muted)" : "var(--color-bg-card)", 
                          border: `1px solid ${isSelected ? "var(--color-primary)" : "var(--color-border)"}`, 
                          borderRadius: "var(--radius-md)", 
                          padding: "10px 14px", 
                          cursor: "pointer", 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{name}</div>
                          {card && auth.role === "admin" && (
                            <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); approveCard(card.report_id, !card.is_approved); }} 
                                style={{ fontSize: "10px", padding: "2px 6px", background: card.is_approved ? "var(--color-success)" : "var(--color-bg-surface)", color: card.is_approved ? "#fff" : "var(--color-text-primary)", border: "1px solid " + (card.is_approved ? "var(--color-success)" : "var(--color-border)"), borderRadius: "4px", cursor: "pointer", fontWeight: 600 }}
                              >
                                {card.is_approved ? "Approved" : "Approve"}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); publishCard(card.report_id, !card.is_published); }} 
                                style={{ fontSize: "10px", padding: "2px 6px", background: card.is_published ? "var(--color-info)" : "var(--color-bg-surface)", color: card.is_published ? "#fff" : "var(--color-text-primary)", border: "1px solid " + (card.is_published ? "var(--color-info)" : "var(--color-border)"), borderRadius: "4px", cursor: "pointer", opacity: card.is_approved ? 1 : 0.5, fontWeight: 600 }}
                              >
                                {card.is_published ? "Published" : "Publish"}
                              </button>
                            </div>
                          )}
                        </div>
                        <Badge text={card ? (card.is_approved ? "Approved" : "Pending") : "No Card"} variant={card ? (card.is_approved ? "success" : "warning") : "neutral"} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Report card preview */}
        <div>
          {loading && (
            <Card style={{ padding: "var(--space-6)", textAlign: "center", display: "flex", justifyContent: "center" }}>
              <div style={{ color: "var(--color-text-muted)" }}>Loading report card...</div>
            </Card>
          )}
          
          {fullData && !loading && (
            <Card style={{ padding: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "var(--color-text-primary)", fontSize: "18px" }}>{fullData.student.full_name}</div>
                  <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{fullData.student.class_name} · {term} {year}</div>
                </div>
                <Button variant="secondary" onClick={printCard}>🖨 Print</Button>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                {[
                  ["Average", `${fullData.average}%`], 
                  ["Present", `${fullData.attendance?.present||0} days`], 
                  ["Absent", `${fullData.attendance?.absent||0} days`], 
                  ["Position", fullData.reportCard?.class_position ? `${fullData.reportCard.class_position}/${fullData.reportCard.out_of||'—'}` : "—"]
                ].map(([l,v]) => (
                  <div key={l} style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "8px 12px" }}>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{l}</div>
                    <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "14px" }}>{v}</div>
                  </div>
                ))}
              </div>
              
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "var(--space-4)" }}>
                <thead>
                  <tr>
                    {["Subject","Score","Grade"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `2px solid var(--color-border)`, fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fullData.results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid var(--color-border)` }}>
                      <td style={{ padding: "10px", color: "var(--color-text-primary)", fontSize: "13px" }}>{r.subject}</td>
                      <td style={{ padding: "10px", color: "var(--color-text-primary)", fontWeight: 600 }}>{r.marks}</td>
                      <td style={{ padding: "10px" }}>
                        <Badge text={r.grade} variant={r.grade==="A" ? "success" : r.grade==="B" ? "info" : r.grade==="C" ? "warning" : "danger"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {fullData.reportCard?.class_teacher_comment && (
                <div style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: "var(--space-2)" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Teacher's Comment</div>
                  <div style={{ color: "var(--color-text-secondary)", fontSize: "13px", fontStyle: "italic" }}>"{fullData.reportCard.class_teacher_comment}"</div>
                </div>
              )}
            </Card>
          )}
          
          {!fullData && !loading && (
            <Card style={{ padding: "var(--space-6)" }}>
              <EmptyState icon="📄" title="Report Card Preview" description="Select a student to view their report card" />
            </Card>
          )}
        </div>
      </div>

      <Modal isOpen={showForm} title="Add Report Card" onClose={() => setShowForm(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={save}>Save Report Card</Button>
        </>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <Select 
              label="Class"
              value={formClass} 
              onChange={e => { setFormClass(e.target.value); setForm({ ...form, studentId: "" }); }}
              options={[
                { value: "", label: "-- Select class first --" },
                ...ALL_CLASSES.map(c => ({ value: c, label: c }))
              ]}
            />
            <Select 
              label="Student"
              value={form.studentId} 
              onChange={e => setForm({ ...form, studentId: e.target.value })} 
              disabled={!formClass}
              options={[
                { value: "", label: formClass ? "-- Select student --" : "-- Select class first --" },
                ...students.filter(s => (s.className ?? s.class_name) === formClass).map(s => ({
                  value: s.id ?? s.student_id,
                  label: s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`
                }))
              ]}
            />
          </div>

          <Input 
            label="Days Present"
            type="number" 
            value={form.daysPresent} 
            onChange={e => setForm({ ...form, daysPresent: e.target.value })} 
          />
          <Input 
            label="Days Absent"
            type="number" 
            value={form.daysAbsent} 
            onChange={e => setForm({ ...form, daysAbsent: e.target.value })} 
          />
          
          <Input 
            label="Class Position"
            type="number" 
            value={form.classPosition} 
            onChange={e => setForm({ ...form, classPosition: e.target.value })} 
          />
          <Input 
            label="Out Of"
            type="number" 
            value={form.outOf} 
            onChange={e => setForm({ ...form, outOf: e.target.value })} 
          />
          
          <div style={{ gridColumn: "1 / -1" }}>
            <Select 
              label="Conduct"
              value={form.conduct} 
              onChange={e => setForm({ ...form, conduct: e.target.value })}
              options={[
                { value: "Excellent", label: "Excellent" },
                { value: "Good", label: "Good" },
                { value: "Fair", label: "Fair" },
                { value: "Poor", label: "Poor" }
              ]}
            />
          </div>
          
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Class Teacher Comment</label>
            <textarea 
              style={{
                width: "100%",
                padding: "var(--space-3)",
                background: "var(--color-bg-base)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                height: 80,
                resize: "vertical"
              }} 
              value={form.classTeacherComment} 
              onChange={e => setForm({ ...form, classTeacherComment: e.target.value })} 
            />
          </div>
          
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Principal Comment</label>
            <textarea 
              style={{
                width: "100%",
                padding: "var(--space-3)",
                background: "var(--color-bg-base)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                height: 80,
                resize: "vertical"
              }} 
              value={form.principalComment} 
              onChange={e => setForm({ ...form, principalComment: e.target.value })} 
            />
          </div>
        </div>
      </Modal>
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
