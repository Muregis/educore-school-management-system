import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";
import AdminSettings from "./AdminSettings";

// ── Shared input style ────────────────────────────────────────────────────────
const inp = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", fontSize: 13, width: "100%",
  boxSizing: "border-box",
};

const Lbl = ({ children }) => (
  <label style={{ display: "block", fontSize: 11, fontWeight: 700,
    color: C.textMuted, marginBottom: 5, textTransform: "uppercase",
    letterSpacing: "0.06em" }}>
    {children}
  </label>
);
Lbl.propTypes = { children: PropTypes.node };

// ── School Info Tab ───────────────────────────────────────────────────────────
function SchoolTab({ school, setSchool, toast, auth }) {
  const [form, setForm] = useState({ ...school });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      // Save regular school info (excluding WhatsApp number)
      const { whatsapp_business_number, ...schoolInfo } = form;
      await apiFetch("/settings/school", {
        method: "PUT",
        token: auth?.token,
        body: schoolInfo,
      });

      // Save WhatsApp number separately if provided
      if (whatsapp_business_number !== undefined) {
        try {
          await apiFetch("/settings/school/whatsapp", {
            method: "PATCH",
            token: auth?.token,
            body: { whatsapp_business_number },
          });
        } catch (whatsappErr) {
          console.warn("WhatsApp number save failed:", whatsappErr);
          toast("School info saved, but WhatsApp number update failed", "warning");
        }
      }

      setSchool(form);
      toast("School info saved", "success");
    } catch (e) {
      toast(e.message || "Save failed", "error");
    }
    setSaving(false);
  };

  const f = (key) => ({
    value: form[key] || "",
    onChange: (e) => setForm((p) => ({ ...p, [key]: e.target.value })),
    style: inp,
  });

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div><Lbl>School Name</Lbl><input {...f("name")} /></div>
        <div><Lbl>County / Location</Lbl><input {...f("county")} /></div>
        <div><Lbl>Phone</Lbl><input {...f("phone")} /></div>
        <div><Lbl>WhatsApp Business Number</Lbl><input {...f("whatsapp_business_number")} placeholder="2547xxxxxxxx" /></div>
        <div><Lbl>Email</Lbl><input {...f("email")} type="email" /></div>
        <div><Lbl>Current Term</Lbl>
          <select {...f("term")} style={inp}>
            {["Term 1", "Term 2", "Term 3"].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div><Lbl>Academic Year</Lbl><input {...f("year")} /></div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Lbl>Postal Address</Lbl><input {...f("address")} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Lbl>School Motto</Lbl><input {...f("motto")} />
        </div>
      </div>
      <button onClick={save} disabled={saving} style={{
        background: C.accent, color: "#fff", border: "none", borderRadius: 9,
        padding: "9px 28px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.7 : 1,
      }}>
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
SchoolTab.propTypes = { school: PropTypes.object, setSchool: PropTypes.func, toast: PropTypes.func, auth: PropTypes.object };

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ auth, toast }) {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]     = useState({ full_name: "", email: "", role: "teacher", password: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch("/settings/users", { token: auth?.token })
      .then(d => { setUsers(d || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, [auth]);

  const save = async () => {
    if (!form.full_name || !form.email || !form.password)
      return toast("Name, email and password are required", "error");
    setSaving(true);
    try {
      await apiFetch("/settings/users", {
        method: "POST", token: auth?.token, body: form,
      });
      toast("User created", "success");
      setForm({ full_name: "", email: "", role: "teacher", password: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast(e.message || "Failed to create user", "error");
    }
    setSaving(false);
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === "active" ? "inactive" : "active";
    try {
      await apiFetch(`/settings/users/${u.user_id}`, {
        method: "PATCH", token: auth?.token, body: { status: newStatus },
      });
      setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, status: newStatus } : x));
      toast(`${u.full_name} ${newStatus}`, "success");
    } catch (e) {
      toast(e.message || "Update failed", "error");
    }
  };

  const roleColors = {
    admin: "#3B82F6", teacher: "#14B8A6", finance: "#F59E0B",
    hr: "#A855F7", librarian: "#22C55E",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.textMuted }}>{users.length} staff accounts</div>
        <button onClick={() => setShowForm(v => !v)} style={{
          background: C.accent, color: "#fff", border: "none", borderRadius: 8,
          padding: "7px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>
          {showForm ? "Cancel" : "+ New User"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><Lbl>Full Name</Lbl>
              <input style={inp} value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Lbl>Email</Lbl>
              <input style={inp} type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Lbl>Role</Lbl>
              <select style={inp} value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {["teacher","finance","hr","librarian","admin"].map(r =>
                  <option key={r}>{r}</option>)}
              </select></div>
            <div><Lbl>Password</Lbl>
              <input style={inp} type="password" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
          </div>
          <button onClick={save} disabled={saving} style={{
            background: C.accent, color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 24px", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>{saving ? "Creating…" : "Create User"}</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: C.textMuted, padding: 24 }}>Loading users…</div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Email", "Role", "Status", "Action"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px",
                    borderBottom: `1px solid ${C.border}`, color: C.textMuted,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 14px", color: C.text, fontWeight: 600 }}>{u.full_name}</td>
                  <td style={{ padding: "10px 14px", color: C.textSub, fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: `${roleColors[u.role] || C.accent}22`,
                      border: `1px solid ${roleColors[u.role] || C.accent}44`,
                      color: roleColors[u.role] || C.accent,
                      borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700,
                      textTransform: "capitalize" }}>{u.role}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      color: u.status === "active" ? "#4ade80" : "#f87171",
                      fontSize: 12, fontWeight: 600,
                    }}>{u.status}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {u.role !== "admin" && (
                      <button onClick={() => toggleStatus(u)} style={{
                        background: "transparent",
                        border: `1px solid ${C.border}`,
                        borderRadius: 7, color: C.textMuted,
                        cursor: "pointer", padding: "4px 12px", fontSize: 12,
                      }}>
                        {u.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
UsersTab.propTypes = { auth: PropTypes.object, toast: PropTypes.func };

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: "school",   label: "🏫 School Info" },
  { id: "users",    label: "👥 Users" },
  { id: "activity", label: "📋 Activity Logs" },
  { id: "backups",  label: "🗄️ DB Backups" },
];

// ── Main SettingsPage ─────────────────────────────────────────────────────────
export default function SettingsPage({ auth, school, setSchool, users, setUsers, toast }) {
  const [tab, setTab] = useState("school");

  // Pass users/setUsers through for legacy local-state compatibility
  void users; void setUsers;

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
            cursor: "pointer",
            background: tab === t.id ? C.accent : C.card,
            color: tab === t.id ? "#fff" : C.textMuted,
            border: `1px solid ${tab === t.id ? C.accent : C.border}`,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "school" && (
        <SchoolTab school={school} setSchool={setSchool} toast={toast} auth={auth} />
      )}
      {tab === "users" && (
        <UsersTab auth={auth} toast={toast} />
      )}
      {(tab === "activity" || tab === "backups") && (
        <AdminSettings auth={auth} initialTab={tab} />
      )}
    </div>
  );
}

SettingsPage.propTypes = {
  auth:      PropTypes.object,
  school:    PropTypes.object,
  setSchool: PropTypes.func,
  users:     PropTypes.array,
  setUsers:  PropTypes.func,
  toast:     PropTypes.func,
};