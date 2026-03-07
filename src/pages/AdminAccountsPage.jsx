import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";

function normaliseUser(u) {
  return {
    id:          u.user_id        ?? u.id,
    name:        u.full_name      ?? u.name       ?? "",
    email:       u.email          ?? "",
    role:        u.role,
    status:      u.status,
    studentId:   u.student_id     ?? u.studentId  ?? null,
    admission:   u.admission_number ?? u.admission ?? "",
    studentName: u.student_name   ?? "",
    className:   u.class_name     ?? "",
  };
}

export default function AdminAccountsPage({ auth, students, toast }) {
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ studentId: "", role: "parent", password: "", confirmPassword: "", name: "" });
  const [filterRole, setFilterRole] = useState("all");
  const [search, setSearch]     = useState("");

  const load = async () => {
    if (!auth?.token) { setLoading(false); return; }
    try {
      const data = await apiFetch("/accounts/portal", { token: auth.token });
      setAccounts(data.map(normaliseUser));
    } catch (e) { console.warn("Accounts:", e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [auth]);

  const selectedStudent = students.find(s => String(s.id ?? s.student_id) === String(form.studentId));

  const openAdd = () => {
    setForm({ studentId: students[0] ? String(students[0].id ?? students[0].student_id) : "", role: "parent", password: "", confirmPassword: "", name: "" });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.studentId) return toast("Select a student", "error");
    if (!form.password)  return toast("Password is required", "error");
    if (form.password !== form.confirmPassword) return toast("Passwords do not match", "error");
    if (form.password.length < 6) return toast("Password must be at least 6 characters", "error");

    setSaving(true);
    try {
      await apiFetch("/accounts/portal", {
        method: "POST",
        body: {
          studentId:  Number(form.studentId),
          role:       form.role,
          password:   form.password,
          name:       form.name || (form.role === "parent"
            ? `Parent of ${selectedStudent?.firstName ?? ""} ${selectedStudent?.lastName ?? ""}`.trim()
            : `${selectedStudent?.firstName ?? ""} ${selectedStudent?.lastName ?? ""}`.trim()),
        },
        token: auth.token,
      });
      await load();
      setShowModal(false);
      toast("Account created", "success");
    } catch (err) { toast(err.message || "Failed to create account", "error"); }
    setSaving(false);
  };

  const toggleStatus = async (acc) => {
    const newStatus = acc.status === "active" ? "inactive" : "active";
    try {
      await apiFetch(`/accounts/portal/${acc.id}`, { method: "PATCH", body: { status: newStatus }, token: auth.token });
      setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, status: newStatus } : a));
      toast(`Account ${newStatus}`, "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const resetPassword = async (acc) => {
    const np = window.prompt(`New password for ${acc.name}:`);
    if (!np) return;
    if (np.length < 6) return toast("Password must be at least 6 characters", "error");
    try {
      await apiFetch(`/accounts/portal/${acc.id}`, { method: "PATCH", body: { password: np }, token: auth.token });
      toast("Password updated", "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const filtered = accounts
    .filter(a => filterRole === "all" || a.role === filterRole)
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.admission.includes(search) || a.className.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, width: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, admission..." />
        <select style={{ ...inputStyle, width: "auto" }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="all">All roles</option>
          <option value="parent">Parents</option>
          <option value="student">Students</option>
        </select>
        <Btn onClick={openAdd}>+ Create Account</Btn>
      </div>

      {loading ? (
        <div style={{ color: C.textMuted, padding: 24 }}>Loading accounts…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.textMuted, padding: 24 }}>
          No portal accounts yet. Click <strong>"+ Create Account"</strong> to create a parent or student login.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Name","Role","Student","Class","Admission","Status","Actions"].map(h =>
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12 }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "8px 10px", color: C.text, fontWeight: 600 }}>{a.name}</td>
                  <td style={{ padding: "8px 10px" }}><Badge text={a.role} tone={a.role === "parent" ? "info" : "success"} /></td>
                  <td style={{ padding: "8px 10px", color: C.textSub }}>{a.studentName || "—"}</td>
                  <td style={{ padding: "8px 10px", color: C.textMuted }}>{a.className || "—"}</td>
                  <td style={{ padding: "8px 10px", color: C.textMuted, fontSize: 12 }}>{a.admission || "—"}</td>
                  <td style={{ padding: "8px 10px" }}><Badge text={a.status} tone={a.status === "active" ? "success" : "danger"} /></td>
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn variant="ghost" onClick={() => toggleStatus(a)}>{a.status === "active" ? "Deactivate" : "Activate"}</Btn>
                      <Btn variant="ghost" onClick={() => resetPassword(a)}>Reset Password</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Create Portal Account" onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Student" style={{ gridColumn: "1 / -1" }}>
              <select style={inputStyle} value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                <option value="">-- Select student --</option>
                {students.map(s => {
                  const sid  = s.id ?? s.student_id;
                  const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
                  const cls  = s.className ?? s.class_name ?? "";
                  const adm  = s.admission ?? s.admission_number ?? "";
                  return <option key={sid} value={sid}>{name} — {cls} ({adm})</option>;
                })}
              </select>
            </Field>
            <Field label="Role">
              <select style={inputStyle} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="parent">Parent / Guardian</option>
                <option value="student">Student</option>
              </select>
            </Field>
            <Field label="Display Name (optional)">
              <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={form.role === "parent"
                  ? `Parent of ${selectedStudent?.firstName ?? "..."}`
                  : selectedStudent?.firstName ?? "..."}
              />
            </Field>
            <Field label="Password">
              <input type="password" style={inputStyle} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
            </Field>
            <Field label="Confirm Password">
              <input type="password" style={inputStyle} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
            </Field>
          </div>
          {selectedStudent && (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginTop: 8, fontSize: 12, color: C.textSub }}>
              Admission number for login: <strong style={{ color: C.accent }}>{selectedStudent.admission ?? selectedStudent.admission_number}</strong>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? "Creating..." : "Create Account"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

AdminAccountsPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array.isRequired,
  toast: PropTypes.func.isRequired,
};
