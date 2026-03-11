import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";

import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES } from "../lib/constants";

const STATUS_TONE = { pending: "warning", reviewed: "info", accepted: "success", rejected: "danger" };

export default function AdmissionsPage({ auth, canEdit, toast }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [showDetail, setShowDetail]     = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    fullName: "", dateOfBirth: "", gender: "male", parentName: "", parentPhone: "",
    parentEmail: "", address: "", previousSchool: "", applyingClass: "Grade 7",
    academicYear: "2026", notes: "",
  });

  const load = async () => {
    if (!auth?.token) return;
    try {
      const data = await apiFetch("/admissions", { token: auth.token });
      setApplications(data);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!form.fullName || !form.applyingClass) return toast("Full name and class are required", "error");
    try {
      await apiFetch("/admissions", { method: "POST", body: form, token: auth.token });
      await load();
      setShowModal(false);
      setForm({ fullName: "", dateOfBirth: "", gender: "male", parentName: "", parentPhone: "", parentEmail: "", address: "", previousSchool: "", applyingClass: "Grade 7", academicYear: "2026", notes: "" });
      toast("Application submitted", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const updateStatus = async (id, status) => {
    try {
      await apiFetch(`/admissions/${id}`, { method: "PATCH", body: { status }, token: auth.token });
      setApplications(prev => prev.map(a => a.admission_id === id ? { ...a, status } : a));
      toast(`Application ${status}`, "success");
      setShowDetail(null);
    } catch (e) { toast(e.message, "error"); }
  };

  const filtered = applications.filter(a => filterStatus === "all" || a.status === filterStatus);
  const counts   = { pending: 0, reviewed: 0, accepted: 0, rejected: 0 };
  applications.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {Object.entries(counts).map(([s, n]) => (
          <div key={s} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px", minWidth: 100 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{n}</div>
            <div style={{ fontSize: 12, color: C.textMuted, textTransform: "capitalize" }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select style={{ ...inputStyle, width: "auto" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <Btn onClick={() => setShowModal(true)}>+ New Application</Btn>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: C.textMuted, padding: 24 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.textMuted, padding: 24 }}>No applications found.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Date","Name","Class","Parent","Phone","Status","Actions"].map(h =>
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12 }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.admission_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "8px 10px", color: C.textMuted, fontSize: 12 }}>{a.created_at?.slice(0,10)}</td>
                  <td style={{ padding: "8px 10px", color: C.text, fontWeight: 600 }}>{a.full_name}</td>
                  <td style={{ padding: "8px 10px", color: C.textSub }}>{a.applying_class}</td>
                  <td style={{ padding: "8px 10px", color: C.textSub }}>{a.parent_name || "—"}</td>
                  <td style={{ padding: "8px 10px", color: C.textMuted, fontSize: 12 }}>{a.parent_phone || "—"}</td>
                  <td style={{ padding: "8px 10px" }}><Badge text={a.status} tone={STATUS_TONE[a.status]} /></td>
                  <td style={{ padding: "8px 10px" }}>
                    <Btn variant="ghost" onClick={() => setShowDetail(a)}>View</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Application Modal */}
      {showModal && (
        <Modal title="New Admission Application" onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Full Name" style={{ gridColumn: "1 / -1" }}>
              <input style={inputStyle} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Student full name" />
            </Field>
            <Field label="Date of Birth">
              <input type="date" style={inputStyle} value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
            </Field>
            <Field label="Gender">
              <select style={inputStyle} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Applying For Class">
              <select style={inputStyle} value={form.applyingClass} onChange={e => setForm({ ...form, applyingClass: e.target.value })}>
                {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Academic Year">
              <input style={inputStyle} value={form.academicYear} onChange={e => setForm({ ...form, academicYear: e.target.value })} />
            </Field>
            <Field label="Parent/Guardian Name">
              <input style={inputStyle} value={form.parentName} onChange={e => setForm({ ...form, parentName: e.target.value })} />
            </Field>
            <Field label="Parent Phone">
              <input style={inputStyle} value={form.parentPhone} onChange={e => setForm({ ...form, parentPhone: e.target.value })} />
            </Field>
            <Field label="Parent Email">
              <input style={inputStyle} value={form.parentEmail} onChange={e => setForm({ ...form, parentEmail: e.target.value })} />
            </Field>
            <Field label="Previous School">
              <input style={inputStyle} value={form.previousSchool} onChange={e => setForm({ ...form, previousSchool: e.target.value })} />
            </Field>
            <Field label="Address" style={{ gridColumn: "1 / -1" }}>
              <input style={inputStyle} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Notes" style={{ gridColumn: "1 / -1" }}>
              <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn onClick={save}>Submit Application</Btn>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <Modal title="Application Details" onClose={() => setShowDetail(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              ["Full Name", showDetail.full_name],
              ["Applying For", showDetail.applying_class],
              ["Date of Birth", showDetail.date_of_birth?.slice(0,10) || "—"],
              ["Gender", showDetail.gender || "—"],
              ["Parent Name", showDetail.parent_name || "—"],
              ["Parent Phone", showDetail.parent_phone || "—"],
              ["Parent Email", showDetail.parent_email || "—"],
              ["Previous School", showDetail.previous_school || "—"],
              ["Applied On", showDetail.created_at?.slice(0,10)],
              ["Status", <Badge key="s" text={showDetail.status} tone={STATUS_TONE[showDetail.status]} />],
            ].map(([label, value]) => (
              <div key={label} style={{ background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{label}</div>
                <div style={{ color: C.text, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
          {showDetail.notes && (
            <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Notes</div>
              <div style={{ color: C.textSub }}>{showDetail.notes}</div>
            </div>
          )}
          {canEdit && showDetail.status === "pending" && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => updateStatus(showDetail.admission_id, "reviewed")}>Mark Reviewed</Btn>
              <Btn variant="ghost" onClick={() => updateStatus(showDetail.admission_id, "rejected")} style={{ color: "#ef4444" }}>Reject</Btn>
              <Btn onClick={() => updateStatus(showDetail.admission_id, "accepted")}>✓ Accept</Btn>
            </div>
          )}
          {canEdit && showDetail.status === "reviewed" && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => updateStatus(showDetail.admission_id, "rejected")} style={{ color: "#ef4444" }}>Reject</Btn>
              <Btn onClick={() => updateStatus(showDetail.admission_id, "accepted")}>✓ Accept</Btn>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

AdmissionsPage.propTypes = {
  auth: PropTypes.object,
  canEdit: PropTypes.bool.isRequired,
  toast: PropTypes.func.isRequired,
};
