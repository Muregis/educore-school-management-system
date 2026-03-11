import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { Pager, Msg, pager } from "../components/Helpers";

function normaliseUser(u) {
  return {
    id:          u.user_id          ?? u.id,
    name:        u.full_name        ?? u.name        ?? "",
    email:       u.email            ?? "",
    phone:       u.phone            ?? "",
    role:        u.role             ?? "",
    status:      u.status           ?? "active",
    studentId:   u.student_id       ?? u.studentId   ?? null,
    admission:   u.admission_number ?? u.admission   ?? "",
    studentName: u.student_name     ?? "",
    className:   u.class_name       ?? "",
  };
}

const roleTone = r => ({ admin: "danger", teacher: "info", finance: "warning", parent: "success", student: "success" }[r] || "info");

export default function AdminAccountsPage({ auth, students, toast }) {
  const [tab, setTab]               = useState("staff");

  // ── Staff state ──────────────────────────────────────────────────────────
  const [staff, setStaff]           = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [showStaff, setShowStaff]   = useState(false);
  const [editStaff, setEditStaff]   = useState(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffPage, setStaffPage]   = useState(1);
  const [staffForm, setStaffForm]   = useState({ name: "", email: "", phone: "", role: "teacher", password: "", confirmPassword: "", status: "active" });
  const [staffSaving, setStaffSaving] = useState(false);

  // ── Portal accounts state ────────────────────────────────────────────────
  const [accounts, setAccounts]     = useState([]);
  const [portalLoading, setPortalLoading] = useState(true);
  const [showPortal, setShowPortal] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);
  const [filterRole, setFilterRole] = useState("all");
  const [portalSearch, setPortalSearch] = useState("");
  const [portalPage, setPortalPage] = useState(1);
  const [portalForm, setPortalForm] = useState({ studentId: "", role: "parent", password: "", confirmPassword: "", name: "" });

  // ── Load staff ────────────────────────────────────────────────────────────
  const loadStaff = async () => {
    if (!auth?.token) { setStaffLoading(false); return; }
    setStaffLoading(true);
    try {
      const data = await apiFetch("/accounts/staff", { token: auth.token });
      setStaff(data.map(normaliseUser));
    } catch (e) { toast("Failed to load staff accounts", "error"); }
    setStaffLoading(false);
  };

  // ── Load portal accounts ──────────────────────────────────────────────────
  const loadPortal = async () => {
    if (!auth?.token) { setPortalLoading(false); return; }
    setPortalLoading(true);
    try {
      const data = await apiFetch("/accounts/portal", { token: auth.token });
      setAccounts(data.map(normaliseUser));
    } catch (e) { toast("Failed to load portal accounts", "error"); }
    setPortalLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStaff(); loadPortal(); }, [auth]);

  // ── Staff CRUD ────────────────────────────────────────────────────────────
  const openAddStaff = () => {
    setEditStaff(null);
    setStaffForm({ name: "", email: "", phone: "", role: "teacher", password: "", confirmPassword: "", status: "active" });
    setShowStaff(true);
  };

  const openEditStaff = (s) => {
    setEditStaff(s);
    setStaffForm({ name: s.name, email: s.email, phone: s.phone, role: s.role, password: "", confirmPassword: "", status: s.status });
    setShowStaff(true);
  };

  const saveStaff = async () => {
    if (!staffForm.name.trim()) return toast("Name is required", "error");
    if (!staffForm.email.trim()) return toast("Email is required", "error");
    if (!editStaff && !staffForm.password) return toast("Password is required", "error");
    if (staffForm.password && staffForm.password !== staffForm.confirmPassword)
      return toast("Passwords do not match", "error");
    if (staffForm.password && staffForm.password.length < 6)
      return toast("Password must be at least 6 characters", "error");

    setStaffSaving(true);
    try {
      if (editStaff) {
        const body = { name: staffForm.name, email: staffForm.email, phone: staffForm.phone, role: staffForm.role, status: staffForm.status };
        if (staffForm.password) body.password = staffForm.password;
        await apiFetch(`/accounts/staff/${editStaff.id}`, { method: "PATCH", body, token: auth.token });
        toast("Staff account updated", "success");
      } else {
        await apiFetch("/accounts/staff", {
          method: "POST",
          body: { name: staffForm.name, email: staffForm.email, phone: staffForm.phone, role: staffForm.role, password: staffForm.password, status: staffForm.status },
          token: auth.token,
        });
        toast("Staff account created", "success");
      }
      setShowStaff(false);
      await loadStaff();
    } catch (err) { toast(err.message || "Failed to save", "error"); }
    setStaffSaving(false);
  };

  const toggleStaffStatus = async (s) => {
    const newStatus = s.status === "active" ? "inactive" : "active";
    try {
      await apiFetch(`/accounts/staff/${s.id}`, { method: "PATCH", body: { status: newStatus }, token: auth.token });
      setStaff(prev => prev.map(x => x.id === s.id ? { ...x, status: newStatus } : x));
      toast(`Account ${newStatus}`, "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const deleteStaff = async (s) => {
    if (!window.confirm(`Delete account for ${s.name}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/accounts/staff/${s.id}`, { method: "DELETE", token: auth.token });
      setStaff(prev => prev.filter(x => x.id !== s.id));
      toast("Account deleted", "success");
    } catch (err) { toast(err.message, "error"); }
  };

  // ── Portal account actions ────────────────────────────────────────────────
  const selectedStudent = students.find(s => String(s.id ?? s.student_id) === String(portalForm.studentId));

  const openAddPortal = () => {
    const first = students[0];
    setPortalForm({ studentId: first ? String(first.id ?? first.student_id) : "", role: "parent", password: "", confirmPassword: "", name: "" });
    setShowPortal(true);
  };

  const savePortal = async () => {
    if (!portalForm.studentId) return toast("Select a student", "error");
    if (!portalForm.password)  return toast("Password is required", "error");
    if (portalForm.password !== portalForm.confirmPassword) return toast("Passwords do not match", "error");
    if (portalForm.password.length < 6) return toast("Password must be at least 6 characters", "error");

    setPortalSaving(true);
    try {
      await apiFetch("/accounts/portal", {
        method: "POST",
        body: {
          studentId: Number(portalForm.studentId),
          role:      portalForm.role,
          password:  portalForm.password,
          name:      portalForm.name || (portalForm.role === "parent"
            ? `Parent of ${selectedStudent?.firstName ?? ""} ${selectedStudent?.lastName ?? ""}`.trim()
            : `${selectedStudent?.firstName ?? ""} ${selectedStudent?.lastName ?? ""}`.trim()),
        },
        token: auth.token,
      });
      await loadPortal();
      setShowPortal(false);
      toast("Portal account created", "success");
    } catch (err) { toast(err.message || "Failed to create account", "error"); }
    setPortalSaving(false);
  };

  const togglePortalStatus = async (acc) => {
    const newStatus = acc.status === "active" ? "inactive" : "active";
    try {
      await apiFetch(`/accounts/portal/${acc.id}`, { method: "PATCH", body: { status: newStatus }, token: auth.token });
      setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, status: newStatus } : a));
      toast(`Account ${newStatus}`, "success");
    } catch (err) { toast(err.message, "error"); }
  };

  const resetPortalPassword = async (acc) => {
    const np = window.prompt(`New password for ${acc.name}:`);
    if (!np) return;
    if (np.length < 6) return toast("Password must be at least 6 characters", "error");
    try {
      await apiFetch(`/accounts/portal/${acc.id}`, { method: "PATCH", body: { password: np }, token: auth.token });
      toast("Password updated", "success");
    } catch (err) { toast(err.message, "error"); }
  };

  // ── Filtered + paged lists ────────────────────────────────────────────────
  const filteredStaff = staff.filter(s =>
    !staffSearch ||
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.role.includes(staffSearch.toLowerCase())
  );
  const { pages: staffPages, rows: staffRows } = pager(filteredStaff, staffPage);

  const filteredPortal = accounts
    .filter(a => filterRole === "all" || a.role === filterRole)
    .filter(a => !portalSearch ||
      a.name.toLowerCase().includes(portalSearch.toLowerCase()) ||
      a.admission.includes(portalSearch) ||
      a.className.toLowerCase().includes(portalSearch.toLowerCase())
    );
  const { pages: portalPages, rows: portalRows } = pager(filteredPortal, portalPage);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Btn variant={tab === "staff"  ? "primary" : "ghost"} onClick={() => setTab("staff")}>
          Staff Accounts ({staff.length})
        </Btn>
        <Btn variant={tab === "portal" ? "primary" : "ghost"} onClick={() => setTab("portal")}>
          Portal Accounts ({accounts.length})
        </Btn>
      </div>

      {/* ── STAFF TAB ────────────────────────────────────────────────────── */}
      {tab === "staff" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle, width: 220 }}
              value={staffSearch}
              onChange={e => setStaffSearch(e.target.value)}
              placeholder="Search name, email, role..."
            />
            <Btn onClick={openAddStaff}>+ Add Staff Account</Btn>
          </div>

          {staffLoading ? (
            <Msg text="Loading staff accounts..." />
          ) : filteredStaff.length === 0 ? (
            <Msg text='No staff accounts yet. Click "+ Add Staff Account" to create one.' />
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <Table
                  headers={["Name", "Email", "Phone", "Role", "Status", "Actions"]}
                  rows={staffRows.map(s => [
                    <span key={s.id} style={{ color: C.text, fontWeight: 600 }}>{s.name}</span>,
                    <span key="e" style={{ color: C.textSub, fontSize: 13 }}>{s.email}</span>,
                    s.phone || "—",
                    <Badge key="r" text={s.role} tone={roleTone(s.role)} />,
                    <Badge key="st" text={s.status} tone={s.status === "active" ? "success" : "danger"} />,
                    <div key="a" style={{ display: "flex", gap: 6 }}>
                      <Btn variant="ghost" onClick={() => openEditStaff(s)}>Edit</Btn>
                      <Btn variant="ghost" onClick={() => toggleStaffStatus(s)}>
                        {s.status === "active" ? "Deactivate" : "Activate"}
                      </Btn>
                      <Btn variant="danger" onClick={() => deleteStaff(s)}>Delete</Btn>
                    </div>,
                  ])}
                />
              </div>
              <Pager page={staffPage} pages={staffPages} setPage={setStaffPage} />
            </>
          )}
        </div>
      )}

      {/* ── PORTAL TAB ───────────────────────────────────────────────────── */}
      {tab === "portal" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle, width: 220 }}
              value={portalSearch}
              onChange={e => setPortalSearch(e.target.value)}
              placeholder="Search name, admission..."
            />
            <select style={{ ...inputStyle, width: "auto" }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="all">All roles</option>
              <option value="parent">Parents</option>
              <option value="student">Students</option>
            </select>
            <Btn onClick={openAddPortal}>+ Create Portal Account</Btn>
          </div>

          {portalLoading ? (
            <Msg text="Loading portal accounts..." />
          ) : filteredPortal.length === 0 ? (
            <Msg text='No portal accounts yet. Click "+ Create Portal Account" to create a parent or student login.' />
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <Table
                  headers={["Name", "Role", "Student", "Class", "Admission", "Status", "Actions"]}
                  rows={portalRows.map(a => [
                    <span key={a.id} style={{ color: C.text, fontWeight: 600 }}>{a.name}</span>,
                    <Badge key="r" text={a.role} tone={roleTone(a.role)} />,
                    a.studentName || "—",
                    a.className   || "—",
                    <span key="adm" style={{ fontSize: 12, color: C.textMuted }}>{a.admission || "—"}</span>,
                    <Badge key="st" text={a.status} tone={a.status === "active" ? "success" : "danger"} />,
                    <div key="ac" style={{ display: "flex", gap: 6 }}>
                      <Btn variant="ghost" onClick={() => togglePortalStatus(a)}>
                        {a.status === "active" ? "Deactivate" : "Activate"}
                      </Btn>
                      <Btn variant="ghost" onClick={() => resetPortalPassword(a)}>Reset Password</Btn>
                    </div>,
                  ])}
                />
              </div>
              <Pager page={portalPage} pages={portalPages} setPage={setPortalPage} />
            </>
          )}
        </div>
      )}

      {/* ── ADD / EDIT STAFF MODAL ───────────────────────────────────────── */}
      {showStaff && (
        <Modal title={editStaff ? "Edit Staff Account" : "Add Staff Account"} onClose={() => setShowStaff(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Full Name" style={{ gridColumn: "1 / -1" }}>
              <input style={inputStyle} value={staffForm.name}
                onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                placeholder="e.g. Jane Wanjiku" />
            </Field>
            <Field label="Email">
              <input style={inputStyle} value={staffForm.email}
                onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                placeholder="jane@school.ac.ke" />
            </Field>
            <Field label="Phone">
              <input style={inputStyle} value={staffForm.phone}
                onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                placeholder="0712 345 678" />
            </Field>
            <Field label="Role">
              <select style={inputStyle} value={staffForm.role}
                onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="finance">Finance</option>
              </select>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={staffForm.status}
                onChange={e => setStaffForm({ ...staffForm, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label={editStaff ? "New Password (leave blank to keep)" : "Password"}>
              <input type="password" style={inputStyle} value={staffForm.password}
                onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                placeholder="Min 6 characters" />
            </Field>
            <Field label="Confirm Password">
              <input type="password" style={inputStyle} value={staffForm.confirmPassword}
                onChange={e => setStaffForm({ ...staffForm, confirmPassword: e.target.value })} />
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowStaff(false)}>Cancel</Btn>
            <Btn onClick={saveStaff} disabled={staffSaving}>
              {staffSaving ? "Saving..." : editStaff ? "Update" : "Create Account"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* ── CREATE PORTAL ACCOUNT MODAL ──────────────────────────────────── */}
      {showPortal && (
        <Modal title="Create Portal Account" onClose={() => setShowPortal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Student" style={{ gridColumn: "1 / -1" }}>
              <select style={inputStyle} value={portalForm.studentId}
                onChange={e => setPortalForm({ ...portalForm, studentId: e.target.value })}>
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
              <select style={inputStyle} value={portalForm.role}
                onChange={e => setPortalForm({ ...portalForm, role: e.target.value })}>
                <option value="parent">Parent / Guardian</option>
                <option value="student">Student</option>
              </select>
            </Field>
            <Field label="Display Name (optional)">
              <input style={inputStyle} value={portalForm.name}
                onChange={e => setPortalForm({ ...portalForm, name: e.target.value })}
                placeholder={portalForm.role === "parent"
                  ? `Parent of ${selectedStudent?.firstName ?? "..."}`
                  : selectedStudent?.firstName ?? "..."} />
            </Field>
            <Field label="Password">
              <input type="password" style={inputStyle} value={portalForm.password}
                onChange={e => setPortalForm({ ...portalForm, password: e.target.value })}
                placeholder="Min 6 characters" />
            </Field>
            <Field label="Confirm Password">
              <input type="password" style={inputStyle} value={portalForm.confirmPassword}
                onChange={e => setPortalForm({ ...portalForm, confirmPassword: e.target.value })} />
            </Field>
          </div>
          {selectedStudent && (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginTop: 8, fontSize: 12, color: C.textSub }}>
              Login with admission number: <strong style={{ color: C.accent }}>{selectedStudent.admission ?? selectedStudent.admission_number}</strong>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowPortal(false)}>Cancel</Btn>
            <Btn onClick={savePortal} disabled={portalSaving}>
              {portalSaving ? "Creating..." : "Create Account"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

AdminAccountsPage.propTypes = {
  auth:     PropTypes.object,
  students: PropTypes.array.isRequired,
  toast:    PropTypes.func.isRequired,
};
