import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Badge from "../components/Badge";
import Table from "../components/Table";
import Modal from "../components/Modal";
import Field from "../components/Field";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";

const DEPT_COLORS = {
  Academic: "#3b82f6", Administration: "#8b5cf6", Finance: "#22c55e",
  Library: "#f59e0b", Transport: "#ec4899", Security: "#ef4444",
  "Support Staff": "#6b7280", Catering: "#f97316"
};

const CONTRACT_TYPES = ["Permanent","Contract","Part-time","Volunteer"];
const DEPARTMENTS = ["Administration","Academic","Finance","HR","Library","Transport","Security","Support Staff","Catering"];

function money(n) { return `KES ${Number(n||0).toLocaleString()}`; }

export default function StaffPage({ auth, canEdit, toast }) {
  const [staff, setStaff]         = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);

  const blank = {
    fullName: "", email: "", phone: "", nationalId: "",
    department: "Academic", jobTitle: "", contractType: "Permanent",
    startDate: "", salary: "", status: "active", notes: ""
  };
  const [form, setForm] = useState(blank);

  const load = async () => {
    setLoading(true);
    try {
      const s = await apiFetch("/hr/staff", { token: auth.token });
      setStaff(Array.isArray(s) ? s : []);
    } catch { /* */ }
    try {
      const u = await apiFetch("/accounts/users", { token: auth.token });
      setUsers(Array.isArray(u) ? u : []);
    } catch { /* */ }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [auth]);

  const filtered = staff.filter(s => {
    const matchDept = filter === "all" || s.department === filter;
    const matchSearch = !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.job_title?.toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const save = async () => {
    if (!form.fullName || !form.jobTitle) return toast("Name and job title required", "error");
    try {
      if (editing) {
        await apiFetch(`/hr/staff/${editing.staff_id}`, { method: "PUT", body: form, token: auth.token });
        toast("Staff updated", "success");
      } else {
        await apiFetch("/hr/staff", { method: "POST", body: form, token: auth.token });
        toast("Staff added", "success");
      }
      setShowModal(false); setEditing(null); setForm(blank); load();
    } catch (e) { toast(e.message, "error"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this staff member?")) return;
    try {
      await apiFetch(`/hr/staff/${id}`, { method: "DELETE", token: auth.token });
      setStaff(prev => prev.filter(s => s.staff_id !== id));
      toast("Removed", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  // Stats
  const byDept = DEPARTMENTS.map(d => ({
    dept: d, count: staff.filter(s => s.department === d).length
  })).filter(d => d.count > 0);

  const totalPayroll = staff.reduce((sum, s) => sum + Number(s.salary||0), 0);

  if (loading) return <div style={{ color: C.textMuted, padding: 24 }}>Loading staff...</div>;

  return (
    <div style={{ padding: 4 }}>
      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {[
          { label: "Total Staff", value: staff.length, color: "#3b82f6" },
          { label: "Active", value: staff.filter(s => s.status === "active").length, color: "#22c55e" },
          { label: "On Leave", value: staff.filter(s => s.status === "on-leave").length, color: "#f59e0b" },
          { label: "Monthly Payroll", value: money(totalPayroll), color: "#8b5cf6" },
        ].map(c => (
          <div key={c.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", minWidth: 140 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Dept breakdown chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {byDept.map(d => (
          <div key={d.dept} onClick={() => setFilter(filter === d.dept ? "all" : d.dept)}
            style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              background: filter === d.dept ? (DEPT_COLORS[d.dept] || C.accent) : C.card,
              color: filter === d.dept ? "#fff" : C.textSub,
              border: `1px solid ${filter === d.dept ? "transparent" : C.border}` }}>
            {d.dept} ({d.count})
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, title..."
          style={{ ...inputStyle, minWidth: 220 }} />
        {canEdit && (
          <Btn onClick={() => { setEditing(null); setForm(blank); setShowModal(true); }}>
            + Add Staff
          </Btn>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>
          No staff found.
        </div>
      ) : (
        <Table
          headers={["Name", "Department", "Role / Title", "Contract", "Salary", "Status", ""]}
          rows={filtered.map(s => [
            <div key="n">
              <div style={{ fontWeight: 600, color: C.text }}>{s.full_name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{s.email || "—"}</div>
              {s.phone && <div style={{ fontSize: 11, color: C.textMuted }}>{s.phone}</div>}
            </div>,
            <span key="d" style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12,
              background: (DEPT_COLORS[s.department] || "#6b7280") + "22",
              color: DEPT_COLORS[s.department] || C.textSub }}>
              {s.department}
            </span>,
            s.job_title || "—",
            s.contract_type || "—",
            <strong key="sal" style={{ color: "#22c55e" }}>{money(s.salary)}</strong>,
            <Badge key="st" tone={s.status === "active" ? "success" : s.status === "on-leave" ? "warning" : "danger"}>
              {s.status}
            </Badge>,
            canEdit && (
              <div key="a" style={{ display: "flex", gap: 6 }}>
                <Btn variant="ghost" onClick={() => {
                  setEditing(s);
                  setForm({
                    fullName: s.full_name, email: s.email||"", phone: s.phone||"",
                    nationalId: s.national_id||"", department: s.department||"Academic",
                    jobTitle: s.job_title||"", contractType: s.contract_type||"Permanent",
                    startDate: s.start_date?.slice(0,10)||"", salary: s.salary||"",
                    status: s.status||"active", notes: s.notes||""
                  });
                  setShowModal(true);
                }}>Edit</Btn>
                <Btn variant="danger" onClick={() => remove(s.staff_id)}>Remove</Btn>
              </div>
            )
          ])}
        />
      )}

      {/* Portal accounts section */}
      {users.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 10, fontSize: 15 }}>
            Portal Accounts
          </div>
          <Table
            headers={["Name", "Email / Login", "Role", "Last Login", "Status"]}
            rows={users.filter(u => ["teacher","hr","finance","librarian","admin"].includes(u.role)).map(u => [
              u.full_name,
              <div key="e"><div style={{ fontSize: 13 }}>{u.email}</div></div>,
              <Badge key="r" tone="info">{u.role}</Badge>,
              u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never",
              <Badge key="s" tone={u.status === "active" ? "success" : "danger"}>{u.status}</Badge>
            ])}
          />
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editing ? "Edit Staff" : "Add Staff Member"} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Full Name *" value={form.fullName} onChange={v => setForm(f => ({...f, fullName: v}))} />
            <Field label="Job Title *" value={form.jobTitle} onChange={v => setForm(f => ({...f, jobTitle: v}))} />
            <Field label="Email" value={form.email} onChange={v => setForm(f => ({...f, email: v}))} />
            <Field label="Phone" value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} />
            <Field label="National ID" value={form.nationalId} onChange={v => setForm(f => ({...f, nationalId: v}))} />
            <Field label="Start Date" type="date" value={form.startDate} onChange={v => setForm(f => ({...f, startDate: v}))} />
            <Field label="Monthly Salary (KES)" type="number" value={form.salary} onChange={v => setForm(f => ({...f, salary: v}))} />
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Department</div>
              <select value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))}
                style={{ ...inputStyle, width: "100%" }}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Contract</div>
              <select value={form.contractType} onChange={e => setForm(f => ({...f, contractType: e.target.value}))}
                style={{ ...inputStyle, width: "100%" }}>
                {CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Status</div>
              <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                style={{ ...inputStyle, width: "100%" }}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Notes</div>
            <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              style={{ ...inputStyle, width: "100%", height: 60, resize: "vertical" }} />
          </div>
          <div style={{ background: "#1e3a5f", border: "1px solid #3b82f6", borderRadius: 8, padding: "8px 12px", marginTop: 10, fontSize: 12, color: "#93c5fd" }}>
            A portal login account will be created automatically using their email. Default password is the part before @ in their email.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Btn>
            <Btn onClick={save}>{editing ? "Update" : "Add Staff"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

StaffPage.propTypes = { auth: PropTypes.object, canEdit: PropTypes.bool, toast: PropTypes.func.isRequired };
