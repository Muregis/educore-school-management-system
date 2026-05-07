import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import AdminSettings from "./AdminSettings";
import ErrorButton from "../components/ErrorButton";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Table from "../components/ui/Table";

function normalizeColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "").trim()) ? value : fallback;
}

// ── School Info Tab ───────────────────────────────────────────────────────────
function SchoolTab({ school, setSchool, toast, auth }) {
  const [form, setForm] = useState({ ...school });
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    setForm({ ...school });
  }, [school]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast("Please select an image file", "error");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast("Image must be less than 2MB", "error");
      return;
    }
    
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setForm(prev => ({ ...prev, logo_url: event.target.result }));
      setLogoUploading(false);
      toast("Logo uploaded", "success");
    };
    reader.onerror = () => {
      setLogoUploading(false);
      toast("Failed to read file", "error");
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      const schoolInfo = {
        name: form.name || "",
        county: form.county || "",
        phone: form.phone || "",
        email: form.email || "",
        address: form.address || "",
        whatsapp_business_number: form.whatsapp_business_number || "",
        term: form.term || "",
        year: form.year || "",
        motto: form.motto || "",
        tagline: form.tagline || "",
        hero_message: form.hero_message || "",
        logo_url: form.logo_url || "",
        primary_color: form.primary_color || "",
        secondary_color: form.secondary_color || "",
        established_year: form.established_year || "",
        admin_name: form.admin_name || "",
        admin_title: form.admin_title || "",
        school_type: form.school_type || "",
        curriculum: form.curriculum || "",
      };
      const response = await apiFetch("/settings/school", {
        method: "PUT",
        token: auth?.token,
        body: schoolInfo,
      });
      
      // Validate response has expected data
      if (!response) {
        throw new Error("No response from server");
      }
      
      if (!response.updated && !response.school) {
        throw new Error("Save failed: unexpected response format");
      }
      
      // Update school state with response data or fallback to sent data
      const updatedSchool = response?.school || schoolInfo;
      setSchool(updatedSchool);
      
      // Update form with saved data to ensure consistency
      setForm(prev => ({
        ...prev,
        ...updatedSchool,
        logo_url: updatedSchool.logo_url || prev.logo_url,
      }));
      
      toast("School info saved", "success");
    } catch (e) {
      console.error("Settings save error:", e);
      toast(e.message || "Save failed", "error");
    }
    setSaving(false);
  };

  return (
    <Card style={{ padding: "var(--space-4)" }}>
      <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-lg)", background: `color-mix(in srgb, ${form.primary_color || "var(--color-primary)"} 15%, transparent)`, border: `1px solid var(--color-border)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {form.logo_url ? (
            <img src={form.logo_url} alt="School logo" style={{ width: 64, height: 64, borderRadius: "var(--radius-md)", objectFit: "cover", border: `1px solid var(--color-border)`, background: "var(--color-bg-surface)" }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${normalizeColor(form.primary_color, "var(--color-primary)")}, ${normalizeColor(form.secondary_color, "var(--color-info)")})`, color: "#fff", fontWeight: 800, fontSize: "28px" }}>
              {String(form.name || "E").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "4px" }}>{form.name || "Your school"}</div>
            <div style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>{form.tagline || form.motto || "Personalized school experience"}</div>
          </div>
        </div>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <Input label="School Name" value={form.name || ""} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
        <Input label="County / Location" value={form.county || ""} onChange={e => setForm(p => ({...p, county: e.target.value}))} />
        <Input label="Phone" value={form.phone || ""} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
        <Input label="WhatsApp Business Number" value={form.whatsapp_business_number || ""} onChange={e => setForm(p => ({...p, whatsapp_business_number: e.target.value}))} placeholder="2547xxxxxxxx" />
        <Input label="Email" type="email" value={form.email || ""} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
        <Select 
          label="Current Term" 
          value={form.term || ""} 
          onChange={e => setForm(p => ({...p, term: e.target.value}))}
          options={[
            { value: "Term 1", label: "Term 1" },
            { value: "Term 2", label: "Term 2" },
            { value: "Term 3", label: "Term 3" }
          ]}
        />
        <Input label="Academic Year" value={form.year || ""} onChange={e => setForm(p => ({...p, year: e.target.value}))} />
        <Input label="Established Year" value={form.established_year || ""} onChange={e => setForm(p => ({...p, established_year: e.target.value}))} placeholder="e.g. 2014" />
        <Select 
          label="School Type" 
          value={form.school_type || ""} 
          onChange={e => setForm(p => ({...p, school_type: e.target.value}))}
          options={[
            { value: "", label: "Select type" },
            { value: "private", label: "Private" },
            { value: "public", label: "Public" },
            { value: "international", label: "International" }
          ]}
        />
        <Select 
          label="Curriculum" 
          value={form.curriculum || ""} 
          onChange={e => setForm(p => ({...p, curriculum: e.target.value}))}
          options={[
            { value: "", label: "Select curriculum" },
            { value: "cbc", label: "CBC" },
            { value: "844", label: "8-4-4" },
            { value: "igcse", label: "IGCSE" },
            { value: "ib", label: "IB" }
          ]}
        />
        
        <div style={{ gridColumn: "1 / -1" }}>
          <Input label="Postal Address" value={form.address || ""} onChange={e => setForm(p => ({...p, address: e.target.value}))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Input label="School Motto" value={form.motto || ""} onChange={e => setForm(p => ({...p, motto: e.target.value}))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Input label="Login Tagline" value={form.tagline || ""} onChange={e => setForm(p => ({...p, tagline: e.target.value}))} placeholder="Shown on the login page" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "var(--space-1)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hero Message</label>
          <textarea 
            value={form.hero_message || ""} 
            onChange={e => setForm(p => ({...p, hero_message: e.target.value}))} 
            rows={3} 
            style={{ width: "100%", padding: "var(--space-3)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-primary)", fontFamily: "inherit", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }} 
            placeholder="Short welcome message for your login page" 
          />
        </div>
        
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>School Logo</label>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <label style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              width: 80, 
              height: 80, 
              borderRadius: "var(--radius-md)", 
              border: `2px dashed var(--color-border)`,
              cursor: "pointer",
              background: "var(--color-bg-base)",
              overflow: "hidden",
              flexShrink: 0,
            }}>
              {logoUploading ? (
                <span style={{ color: "var(--color-text-secondary)", fontSize: "12px", fontWeight: 500 }}>Uploading...</span>
              ) : form.logo_url ? (
                <img src={form.logo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "24px", color: "var(--color-text-muted)" }}>+</span>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload} 
                style={{ display: "none" }}
              />
            </label>
            <div style={{ flex: 1 }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload}
                style={{ width: "100%", padding: "8px", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-primary)", boxSizing: "border-box" }}
              />
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
                Click to upload. Use PNG or JPG. Max 2MB.
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "var(--space-1)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Primary Color</label>
          <input value={normalizeColor(form.primary_color, "var(--color-primary)")} onChange={e => setForm(p => ({...p, primary_color: e.target.value}))} type="color" style={{ width: "100%", height: "42px", padding: "4px", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer", boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "var(--space-1)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Secondary Color</label>
          <input value={normalizeColor(form.secondary_color, "var(--color-info)")} onChange={e => setForm(p => ({...p, secondary_color: e.target.value}))} type="color" style={{ width: "100%", height: "42px", padding: "4px", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer", boxSizing: "border-box" }} />
        </div>
        
        <Input label="Administrator Name" value={form.admin_name || ""} onChange={e => setForm(p => ({...p, admin_name: e.target.value}))} placeholder="e.g. Jane Wanjiku" />
        <Input label="Administrator Title" value={form.admin_title || ""} onChange={e => setForm(p => ({...p, admin_title: e.target.value}))} placeholder="e.g. School Principal" />
      </div>
      
      <Button onClick={save} disabled={saving} style={{ padding: "10px 24px", fontSize: "15px" }}>
        {saving ? "Saving…" : "Save School Information"}
      </Button>
    </Card>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-secondary)" }}>{users.length} staff accounts</div>
          <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm(v => !v)}>
            {showForm ? "Cancel" : "+ New User"}
          </Button>
        </div>
      </Card>

      {showForm && (
        <Card style={{ padding: "var(--space-4)", background: "var(--color-bg-base)", border: "1px solid var(--color-primary-muted)" }}>
          <h3 style={{ margin: "0 0 var(--space-4) 0", fontSize: "16px", color: "var(--color-text-primary)" }}>Create New Account</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <Input label="Full Name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <Select 
              label="Role" 
              value={form.role} 
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              options={[
                { value: "teacher", label: "Teacher" },
                { value: "finance", label: "Finance" },
                { value: "hr", label: "HR" },
                { value: "librarian", label: "Librarian" },
                { value: "admin", label: "Admin" }
              ]}
            />
            <Input label="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create User"}</Button>
        </Card>
      )}

      {loading ? (
        <div style={{ color: "var(--color-text-muted)", padding: "var(--space-4)", textAlign: "center" }}>Loading users…</div>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Name", "Email", "Role", "Status", "Action"]}
            data={users.map(u => [
              <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{u.full_name}</span>,
              <span key="email" style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>{u.email}</span>,
              <Badge key="role" text={u.role} variant={u.role === "admin" ? "primary" : u.role === "finance" ? "warning" : u.role === "hr" ? "danger" : u.role === "librarian" ? "success" : "info"} />,
              <Badge key="status" text={u.status} variant={u.status === "active" ? "success" : "danger"} />,
              u.role !== "admin" ? (
                <Button key="action" size="sm" variant="secondary" onClick={() => toggleStatus(u)}>
                  {u.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              ) : <span key="action"></span>
            ])}
          />
        </Card>
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
  { id: "dev",      label: "🐛 Dev Tools" },
];

// ── Main SettingsPage ─────────────────────────────────────────────────────────
export default function SettingsPage({ auth, school, setSchool, users, setUsers, toast }) {
  const [tab, setTab] = useState("school");

  // Pass users/setUsers through for legacy local-state compatibility
  void users; void setUsers;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--color-border)" }}>
        {TABS.map(t => (
          <Button 
            key={t.id} 
            variant={tab === t.id ? "primary" : "secondary"} 
            onClick={() => setTab(t.id)}
            style={{ fontWeight: 600 }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ marginTop: "var(--space-2)" }}>
        {tab === "school" && (
          <SchoolTab school={school} setSchool={setSchool} toast={toast} auth={auth} />
        )}
        {tab === "users" && (
          <UsersTab auth={auth} toast={toast} />
        )}
        {(tab === "activity" || tab === "backups") && (
          <AdminSettings auth={auth} initialTab={tab} />
        )}
        {tab === "dev" && (
          <Card style={{ padding: "var(--space-4)" }}>
            <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Developer Tools</h3>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>Use these tools to test error tracking and debugging features.</p>
            <ErrorButton />
          </Card>
        )}
      </div>
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
