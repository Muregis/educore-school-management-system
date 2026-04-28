import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { NAV, NAV_EXTRAS, ROLE } from "../lib/constants";
import PropTypes from "prop-types";

// ─── DESIGN TOKENS (matching EduCore) ────────────────────────────────────────
const C = {
  bg: "#080C14",
  surface: "#0E1420",
  card: "#121929",
  border: "#1E2D47",
  accent: "#3B82F6",
  accentGlow: "rgba(59,130,246,0.12)",
  accentDim: "#1D3461",
  teal: "#14B8A6",
  tealDim: "#0D3330",
  amber: "#F59E0B",
  amberDim: "#3D2200",
  rose: "#F43F5E",
  roseDim: "#3D0015",
  green: "#22C55E",
  greenDim: "#0D2E1A",
  purple: "#A855F7",
  purpleDim: "#2D1554",
  text: "#E2EAF8",
  textSub: "#7A92B8",
  textMuted: "#3D5070",
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = "currentColor" }) => {
  const icons = {
    school:   <><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></>,
    users:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    lock:     <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    bell:     <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    save:     <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
    edit:     <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    check:    <><polyline points="20 6 9 17 4 12"/></>,
    x:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff:   <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>,
    shield:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    phone:    <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></>,
    mail:     <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    map:      <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
    user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    key:      <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,
    toggle:   <><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/></>,
    "arrow-up": <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || null}
    </svg>
  );
};

Icon.propTypes = { name: PropTypes.string.isRequired, size: PropTypes.number, color: PropTypes.string };

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 14,
  outline: "none", boxSizing: "border-box",
};

const Field = ({ label, hint, children }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{hint}</div>}
  </div>
);

Field.propTypes = { label: PropTypes.string.isRequired, hint: PropTypes.string, children: PropTypes.node.isRequired };

const Inp = ({ label, hint, type = "text", value, onChange, placeholder }) => (
  <Field label={label} hint={hint}>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
  </Field>
);

Inp.propTypes = { label: PropTypes.string.isRequired, hint: PropTypes.string, type: PropTypes.string, value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, placeholder: PropTypes.string };

const Sel = ({ label, hint, value, onChange, options }) => (
  <Field label={label} hint={hint}>
    <select value={value} onChange={onChange} style={{ ...inputStyle, cursor: "pointer" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

Sel.propTypes = { label: PropTypes.string.isRequired, hint: PropTypes.string, value: PropTypes.string.isRequired, onChange: PropTypes.func.isRequired, options: PropTypes.array.isRequired };

const Btn = ({ children, onClick, variant = "primary", icon, color }) => {
  const vs = {
    primary: { background: color || C.accent, color: "#fff", border: "none" },
    ghost:   { background: "transparent", color: C.textSub, border: `1px solid ${C.border}` },
    danger:  { background: C.roseDim, color: C.rose, border: `1px solid ${C.rose}44` },
    success: { background: C.greenDim, color: C.green, border: `1px solid ${C.green}44` },
  };
  return (
    <button onClick={onClick} style={{ ...vs[variant], borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
      {icon && <Icon name={icon} size={14} color="currentColor" />}{children}
    </button>
  );
};

Btn.propTypes = { children: PropTypes.node.isRequired, onClick: PropTypes.func.isRequired, variant: PropTypes.string, icon: PropTypes.string, color: PropTypes.string };

// Toast notification
const Toast = ({ msg, type, onDone }) => {
  const colors = { success: C.green, error: C.rose, info: C.accent };
  const color = colors[type] || C.accent;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 2000,
      background: C.card, border: `1px solid ${color}44`,
      borderLeft: `4px solid ${color}`, borderRadius: 12,
      padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
      boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
      animation: "slideIn 0.3s ease",
    }}>
      <Icon name={type === "success" ? "check" : type === "error" ? "x" : "bell"} size={16} color={color} />
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{msg}</span>
      <button onClick={onDone} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", marginLeft: 8 }}>
        <Icon name="x" size={14} />
      </button>
      <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
};

Toast.propTypes = { msg: PropTypes.string, type: PropTypes.string, onDone: PropTypes.func };

// Toggle switch
const Toggle = ({ value, onChange, label, description }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
      {description && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{description}</div>}
    </div>
    <div onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 99, cursor: "pointer", position: "relative",
      background: value ? C.accent : C.border, transition: "background 0.2s",
      flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }} />
    </div>
  </div>
);

Toggle.propTypes = { value: PropTypes.bool.isRequired, onChange: PropTypes.func.isRequired, label: PropTypes.string.isRequired, description: PropTypes.string };

// Section card wrapper
const Section = ({ title, subtitle, icon, color = C.accent, dim = C.accentGlow, children }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
    <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ background: dim, borderRadius: 10, padding: 9 }}>
        <Icon name={icon} size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ padding: 24 }}>{children}</div>
  </div>
);

Section.propTypes = { title: PropTypes.string.isRequired, subtitle: PropTypes.string, icon: PropTypes.string.isRequired, color: PropTypes.string, dim: PropTypes.string, children: PropTypes.node.isRequired };

// ─── MOCK USER ACCOUNTS ───────────────────────────────────────────────────────
const INITIAL_USERS = [];

const ROLE_META = {
  admin:   { label: "Admin",   color: C.purple, dim: C.purpleDim },
  teacher: { label: "Teacher", color: C.teal,   dim: C.tealDim },
  finance: { label: "Finance", color: C.green,  dim: C.greenDim },
  viewer:  { label: "Viewer",  color: C.amber,  dim: C.amberDim },
};

// Fallback for unknown roles
const getRoleMeta = (role) => ROLE_META[role] || { label: role, color: C.textMuted, dim: C.surface };

// ─── TABS ─────────────────────────────────────────────────────────────────────
// ─── ACTIVITY LOGS TAB ───────────────────────────────────────────────────────
const ActivityLogsTab = ({ auth }) => {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("");

  useEffect(() => {
    apiFetch("/activity-logs?limit=200", { token: auth?.token })
      .then(d => { setLogs(d.logs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [auth]);

  const filtered = filter
    ? logs.filter(l => l.action?.includes(filter) || l.user_name?.toLowerCase().includes(filter.toLowerCase()) || l.description?.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const actionColor = (action) => {
    if (action?.startsWith("auth"))     return "#a78bfa";
    if (action?.startsWith("payment"))  return "#4ade80";
    if (action?.startsWith("student"))  return "#60a5fa";
    if (action?.startsWith("grade"))    return "#f59e0b";
    return "#94a3b8";
  };

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter by action, user or description..."
          style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13, width:"100%", maxWidth:360 }} />
      </div>
      {loading ? <div style={{ color:"#94a3b8" }}>Loading...</div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:520, overflowY:"auto" }}>
          {filtered.length === 0 && <div style={{ color:"#94a3b8", fontSize:13 }}>No activity logs found.</div>}
          {filtered.map(log => (
            <div key={log.log_id} style={{ display:"flex", alignItems:"flex-start", gap:12,
              background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:8, padding:"10px 14px" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:actionColor(log.action),
                marginTop:5, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:actionColor(log.action),
                    background:actionColor(log.action)+"22", padding:"1px 7px", borderRadius:4 }}>
                    {log.action}
                  </span>
                  {log.user_name && <span style={{ fontSize:12, color:"#94a3b8" }}>by {log.user_name}</span>}
                  <span style={{ fontSize:11, color:"#64748b", marginLeft:"auto" }}>
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                {log.description && <div style={{ fontSize:12, color:"#cbd5e1", marginTop:3 }}>{log.description}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
ActivityLogsTab.propTypes = { auth: PropTypes.object };

// ─── BACKUPS TAB ──────────────────────────────────────────────────────────────
const BackupsTab = ({ auth }) => {
  const [backups, setBackups]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [message, setMessage]   = useState(null);

  const load = () => {
    apiFetch("/admin/backups", { token: auth?.token })
      .then(d => { setBackups(d.backups || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, [auth]);

  const triggerBackup = async () => {
    setRunning(true); setMessage(null);
    try {
      const res = await apiFetch("/admin/backups", { method:"POST", token: auth?.token });
      setMessage({ type:"success", text:`✅ ${res.message} — ${res.filename} (${res.sizeKb} KB)` });
      load();
    } catch(e) {
      setMessage({ type:"error", text:`❌ Backup failed: ${e.message}` });
    }
    setRunning(false);
  };

  const deleteBackup = async (filename) => {
    if (!confirm(`Delete ${filename}?`)) return;
    try {
      await apiFetch(`/admin/backups/${filename}`, { method:"DELETE", token: auth?.token });
      load();
    } catch(e) { alert(e.message); }
  };

  return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <button onClick={triggerBackup} disabled={running} style={{
          background: running ? "#334155" : "linear-gradient(135deg,#3B82F6,#6366f1)",
          color:"#fff", border:"none", borderRadius:8, padding:"9px 20px",
          fontWeight:700, fontSize:13, cursor: running ? "not-allowed" : "pointer",
        }}>{running ? "⏳ Running backup..." : "💾 Run Backup Now"}</button>
        <span style={{ fontSize:12, color:"#94a3b8" }}>Last 7 backups kept automatically. Backups run daily at midnight.</span>
      </div>
      {message && (
        <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:8, fontSize:13,
          background: message.type === "success" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
          border: `1px solid ${message.type === "success" ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
          color: message.type === "success" ? "#4ade80" : "#f87171" }}>
          {message.text}
        </div>
      )}
      {loading ? <div style={{ color:"#94a3b8" }}>Loading...</div> : (
        backups.length === 0
          ? <div style={{ color:"#94a3b8", fontSize:13 }}>No backups found. Run your first backup above.</div>
          : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {backups.map(b => (
                <div key={b.filename} style={{ display:"flex", alignItems:"center", gap:12,
                  background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
                  borderRadius:8, padding:"10px 16px" }}>
                  <span style={{ fontSize:18 }}>🗄️</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{b.filename}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>
                      {b.sizeKb} KB · {new Date(b.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <a href={`${import.meta.env.VITE_API_URL}/admin/backups/${b.filename}/download`}
                    style={{ fontSize:12, color:"#60a5fa", textDecoration:"none", fontWeight:600 }}>
                    ⬇ Download
                  </a>
                  <button onClick={() => deleteBackup(b.filename)} style={{
                    background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)",
                    color:"#f87171", borderRadius:6, padding:"4px 10px", fontSize:12, cursor:"pointer",
                  }}>Delete</button>
                </div>
              ))}
            </div>
      )}
    </div>
  );
};
BackupsTab.propTypes = { auth: PropTypes.object };

// ─── PROMOTION CHAIN TAB ─────────────────────────────────────────────────
const PromotionChainTab = ({ auth }) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => { loadClasses(); }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/classes/promotion-chain', { token: auth.token });
      setClasses(res.data || res || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateNextClass = async (classId, nextClassName) => {
    setSaving(classId);
    try {
      await apiFetch(`/classes/${classId}/promotion`, {
        method: 'PUT',
        token: auth.token,
        body: { nextClassName }
      });
      loadClasses();
    } catch (err) { console.error(err); }
    finally { setSaving(null); }
  };

  const availableClasses = classes.map(c => c.class_name);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ color: C.textSub, fontSize: 13 }}>
        Set which class students will be promoted to when the term ends. Students will automatically move to their next class when you close the term.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
        {classes.map(cls => (
          <div key={cls.class_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: C.text }}>{cls.class_name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>Promotes to:</div>
            <select
              value={cls.next_class_name || ""}
              onChange={e => updateNextClass(cls.class_id, e.target.value)}
              disabled={saving === cls.class_id}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.bg, color: C.text, fontSize: 13,
              }}
            >
              <option value="">No promotion (final class)</option>
              {availableClasses.filter(c => c !== cls.class_name).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ color: C.text, marginBottom: 12 }}>Promotion Flow</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {classes.filter(c => c.next_class_name).map((cls, i) => (
            <React.Fragment key={cls.class_id}>
              <span style={{ background: C.accentGlow, color: C.accent, padding: "6px 12px", borderRadius: 8, fontSize: 13 }}>
                {cls.class_name}
              </span>
              <span style={{ color: C.textMuted }}>→</span>
              <span style={{ background: C.tealDim, color: C.teal, padding: "6px 12px", borderRadius: 8, fontSize: 13 }}>
                {cls.next_class_name}
              </span>
              {i < classes.filter(c => c.next_class_name).length - 1 && <span style={{ color: C.textMuted }}>&nbsp;→&nbsp;</span>}
            </React.Fragment>
          ))}
          {classes.every(c => !c.next_class_name) && (
            <p style={{ color: C.textMuted, fontSize: 13 }}>No promotion chain configured yet</p>
          )}
        </div>
      </div>
    </div>
  );
};
PromotionChainTab.propTypes = { auth: PropTypes.object };

const TABS = [
  { id: "school",        label: "School Info",    icon: "school" },
  { id: "users",         label: "User Accounts",  icon: "users" },
  { id: "permissions",   label: "Permissions",    icon: "lock" },
  { id: "security",      label: "Security",       icon: "shield" },
  { id: "notifications", label: "Notifications",  icon: "bell" },
  { id: "activity",      label: "Activity Logs",  icon: "activity" },
  { id: "backups",       label: "DB Backups",     icon: "database" },
  { id: "integrations",  label: "Integrations",   icon: "key" },
  { id: "promotion",    label: "Promotion Chain", icon: "arrow-up" },
];

// ─── SCHOOL INFO TAB ──────────────────────────────────────────────────────────
const SchoolInfoTab = ({ onSave, auth }) => {
  const [form, setForm] = useState({
    name:        "",
    motto:       "",
    type:        "private",
    curriculum:  "cbc",
    email:       "",
    phone:       "",
    whatsapp_business_number: "",
    address:     "",
    county:      "",
    term:        "Term 2",
    year:        "2025",
    term_start:  "2025-05-05",
    term_end:    "2025-08-01",
    admin_name:  "",
    admin_title: "",
    logo_url:    "",
    favicon_url: "",
    primary_color: "#3B82F6",
    secondary_color: "#1A2A42",
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Load existing school data
  useEffect(() => {
    if (auth?.token) {
      apiFetch("/settings/school", { token: auth.token })
        .then(data => {
          setForm(prev => ({
            ...prev,
            name: data.name || prev.name,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
            whatsapp_business_number: data.whatsapp_business_number || "",
            address: data.address || prev.address,
            county: data.county || prev.county,
            motto: data.motto || data.tagline || prev.motto,
            logo_url: data.logo_url || prev.logo_url,
            primary_color: data.primary_color || prev.primary_color,
            secondary_color: data.secondary_color || prev.secondary_color,
            term: data.term || prev.term,
            year: data.year || prev.year,
            term_start: data.term_start || data.term_start_date || prev.term_start,
            term_end: data.term_end || data.term_end_date || prev.term_end,
            type: data.school_type || prev.type,
            curriculum: data.curriculum || prev.curriculum,
            admin_name: data.admin_name || prev.admin_name,
            admin_title: data.admin_title || prev.admin_title,
          }));
        })
        .catch(() => {
          // School data not found, keep defaults
        });
    }
  }, [auth]);

  const f = k => e => setForm({ ...form, [k]: e.target.value });

  const saveSchoolInfo = async () => {
    setLoading(true); setMessage(null);
    try {
      // Save all school settings via PUT /settings/school
      const saveRes = await apiFetch("/settings/school", {
        method: "PUT",
        body: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          county: form.county,
          whatsapp_business_number: form.whatsapp_business_number,
          term: form.term,
          year: form.year,
          term_start: form.term_start,
          term_end: form.term_end,
          motto: form.motto,
          tagline: form.motto, // Use motto as tagline if not separately set
          logo_url: form.logo_url,
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          school_type: form.type,
          curriculum: form.curriculum,
          admin_name: form.admin_name,
          admin_title: form.admin_title,
        },
        token: auth?.token,
      });
      console.log('[DEBUG] School settings save response:', saveRes);
      
      setMessage({ type: "success", text: "School settings saved successfully!" });
      onSave();
    } catch (err) {
      console.error('[DEBUG] Save failed:', err);
      setMessage({ type: "error", text: err.message || "Failed to save school settings" });
    }
    setLoading(false);
  };

  return (
    <div>
      {/* School identity */}
      <div style={{ background: C.accentGlow, border: `1px solid ${C.accentDim}`, borderRadius: 14, padding: 20, marginBottom: 24, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: `linear-gradient(135deg, ${C.accent}, #6366F1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, overflow: 'hidden' }}>
          {form.logo_url ? (
            <img src={form.logo_url} alt="School logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            "🏫"
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{form.name}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{form.motto}</div>
          <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
            <span style={{ background: C.accentDim, borderRadius: 5, padding: "2px 8px", marginRight: 6, fontWeight: 600 }}>{form.curriculum.toUpperCase()}</span>
            <span style={{ background: C.surface, borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>{form.type.charAt(0).toUpperCase() + form.type.slice(1)}</span>
          </div>
        </div>
      </div>

      {/* School Branding / Logo Upload */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>School Branding</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          <div>
            <label style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, display: 'block' }}>School Logo</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 80, height: 80, borderRadius: 12, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", overflow: 'hidden', border: `2px dashed ${C.border}` }}>
                {logoPreview || form.logo_url ? (
                  <img src={logoPreview || form.logo_url} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 32 }}>🏫</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setLogoFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setLogoPreview(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ fontSize: 11, color: C.textMuted }}>Recommended: 200x200px PNG/JPG</div>
              </div>
            </div>
          </div>
          
          <div>
            <label style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, display: 'block' }}>Brand Colors</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, display: 'block' }}>Primary</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={f("primary_color")}
                    style={{ width: 40, height: 40, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.primary_color}
                    onChange={f("primary_color")}
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                    placeholder="#3B82F6"
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, display: 'block' }}>Secondary</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    value={form.secondary_color}
                    onChange={f("secondary_color")}
                    style={{ width: 40, height: 40, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.secondary_color}
                    onChange={f("secondary_color")}
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                    placeholder="#1A2A42"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: C.border, margin: "8px 0 20px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
        <Inp label="School Name" value={form.name} onChange={f("name")} placeholder="e.g. Sunrise Academy" />
        <Inp label="School Motto" value={form.motto} onChange={f("motto")} placeholder="e.g. Excellence in Every Child" />
        <Sel label="School Type" value={form.type} onChange={f("type")} options={[{value:"private",label:"Private"},{value:"public",label:"Public"},{value:"international",label:"International"}]} />
        <Sel label="Curriculum" value={form.curriculum} onChange={f("curriculum")} options={[{value:"cbc",label:"CBC (Competency Based)"},{value:"844",label:"8-4-4"},{value:"igcse",label:"IGCSE"},{value:"ib",label:"IB"}]} />
      </div>

      <div style={{ height: 1, background: C.border, margin: "8px 0 20px" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Contact & Location</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
        <Inp label="School Email" type="email" value={form.email} onChange={f("email")} placeholder="admin@school.ac.ke" />
        <Inp label="Phone Number" value={form.phone} onChange={f("phone")} placeholder="+254 7XX XXX XXX" />
        <Inp label="Physical Address" value={form.address} onChange={f("address")} placeholder="Street, Town" />
        <Inp label="County" value={form.county} onChange={f("county")} placeholder="e.g. Nairobi" />
      </div>

      <div style={{ height: 1, background: C.border, margin: "8px 0 20px" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>WhatsApp Business Settings</div>
      <div style={{ background: C.tealDim, border: `1px solid ${C.teal}44`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 20 }}>📱</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>WhatsApp Business Number</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              Parents will click "Send to School WhatsApp" and message this number directly
            </div>
          </div>
        </div>
        <Inp 
          label="WhatsApp Business Number" 
          hint="Formats: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx (Kenyan numbers)"
          value={form.whatsapp_business_number} 
          onChange={f("whatsapp_business_number")} 
          placeholder="254712345678 or 0112345678" 
        />
        {form.whatsapp_business_number && (
          <div style={{ marginTop: 12, padding: 10, background: C.surface, borderRadius: 8, fontSize: 11, color: C.textSub }}>
            ✅ Parents will be able to send payment receipts to: 
            <a 
              href={`https://wa.me/${form.whatsapp_business_number.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.teal, textDecoration: "none", fontWeight: 600, marginLeft: 6 }}
            >
              {form.whatsapp_business_number}
            </a>
          </div>
        )}
      </div>

      <div style={{ height: 1, background: C.border, margin: "8px 0 20px" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Current Academic Term</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0 24px" }}>
        <Sel label="Term" value={form.term} onChange={f("term")} options={["Term 1","Term 2","Term 3"].map(t=>({value:t,label:t}))} />
        <Inp label="Year" value={form.year} onChange={f("year")} placeholder="e.g. 2025" />
        <Inp label="Term Start" type="date" value={form.term_start} onChange={f("term_start")} />
        <Inp label="Term End" type="date" value={form.term_end} onChange={f("term_end")} />
      </div>

      <div style={{ height: 1, background: C.border, margin: "8px 0 20px" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Administrator</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
        <Inp label="Admin Name" value={form.admin_name} onChange={f("admin_name")} placeholder="e.g. Jane Doe" />
        <Inp label="Admin Title / Role" value={form.admin_title} onChange={f("admin_title")} placeholder="e.g. School Principal" />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Btn icon="save" onClick={saveSchoolInfo} disabled={loading}>
          {loading ? "Saving..." : "Save School Info"}
        </Btn>
      </div>
      
      {message && (
        <div style={{
          marginTop: 16,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          background: message.type === "success" ? C.greenDim : C.roseDim,
          border: `1px solid ${message.type === "success" ? C.green : C.rose}44`,
          color: message.type === "success" ? C.green : C.rose,
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

SchoolInfoTab.propTypes = { onSave: PropTypes.func.isRequired, auth: PropTypes.object };

// ─── USERS TAB ────────────────────────────────────────────────────────────────
const UsersTab = ({ onSave, auth }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", role: "teacher", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [message, setMessage] = useState(null);
  const f = k => e => setForm({ ...form, [k]: e.target.value });

  // Load real users from backend
  const loadUsers = async () => {
    try {
      const data = await apiFetch("/accounts/staff", { token: auth?.token });
      // Map backend fields to frontend format
      const mapped = (data || []).map(u => ({
        id: u.user_id,
        name: u.full_name,
        email: u.email,
        role: u.role,
        status: u.status,
        initials: u.full_name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??",
        color: colorPairs[Math.floor(Math.random() * colorPairs.length)],
      }));
      setUsers(mapped);
    } catch (e) {
      console.error("Failed to load users:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth?.token) loadUsers();
  }, [auth]);

  const initials = name => name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
  const colorPairs = [[C.accent, C.purple],[C.teal, C.accent],[C.amber, C.rose],[C.purple, C.teal],[C.green, C.teal],[C.rose, C.amber]];

  // CREATE / UPDATE user via API
  const addUser = async () => {
    if (!form.name || !form.email) return;
    setLoading(true);
    try {
      if (editId) {
        // Update existing user
        const updates = {};
        if (form.name) updates.name = form.name;
        if (form.email) updates.email = form.email;
        if (form.role && ["admin","teacher","finance"].includes(form.role)) updates.role = form.role;
        if (form.password) updates.password = form.password;
        
        await apiFetch(`/accounts/staff/${editId}`, {
          method: "PATCH",
          token: auth?.token,
          body: updates,
        });
        setMessage({ type: "success", text: "User updated successfully" });
      } else {
        // Create new user
        await apiFetch("/accounts/staff", {
          method: "POST",
          token: auth?.token,
          body: {
            name: form.name,
            email: form.email,
            role: form.role,
            password: form.password,
          },
        });
        setMessage({ type: "success", text: "User created successfully" });
      }
      await loadUsers();
      setForm({ name: "", email: "", role: "teacher", password: "" });
      setShowAdd(false);
      setEditId(null);
      onSave();
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Failed to save user" });
    }
    setLoading(false);
  };

  const startEdit = u => {
    setForm({ name: u.name, email: u.email, role: u.role, password: "" });
    setEditId(u.id);
    setShowAdd(true);
  };

  // Toggle status via API (active/inactive)
  const toggleStatus = async id => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const newStatus = user.status === "active" ? "inactive" : "active";
    
    setLoading(true);
    try {
      await apiFetch(`/accounts/staff/${id}`, {
        method: "PATCH",
        token: auth?.token,
        body: { status: newStatus },
      });
      await loadUsers();
      setMessage({ type: "success", text: `User ${newStatus === "active" ? "activated" : "deactivated"}` });
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Failed to update status" });
    }
    setLoading(false);
  };

  // Soft delete via API
  const deleteUser = async id => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setLoading(true);
    try {
      await apiFetch(`/accounts/staff/${id}`, {
        method: "DELETE",
        token: auth?.token,
      });
      await loadUsers();
      setMessage({ type: "success", text: "User deleted successfully" });
    } catch (e) {
      setMessage({ type: "error", text: e.message || "Failed to delete user" });
    }
    setLoading(false);
  };

  if (loading && users.length === 0) return <div style={{ color: C.textSub }}>Loading users...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.textSub }}>{users.length} accounts · {users.filter(u => u.status === "active").length} active</div>
        <Btn icon="plus" onClick={() => { setShowAdd(true); setEditId(null); setForm({ name: "", email: "", role: "teacher", password: "" }); }}>Add User</Btn>
      </div>

      {message && (
        <div style={{
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          background: message.type === "success" ? C.greenDim : C.roseDim,
          border: `1px solid ${message.type === "success" ? C.green : C.rose}44`,
          color: message.type === "success" ? C.green : C.rose,
        }}>
          {message.text}
        </div>
      )}

      {/* Add / Edit form */}
      {showAdd && (
        <div style={{ background: C.surface, border: `1px solid ${C.accentDim}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>{editId ? "Edit User" : "New User Account"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
            <Inp label="Full Name" value={form.name} onChange={f("name")} placeholder="e.g. Grace Akinyi" />
            <Inp label="Email Address" type="email" value={form.email} onChange={f("email")} placeholder="user@school.ac.ke" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
            <Sel label="Role" value={form.role} onChange={f("role")} options={[{value:"admin",label:"Admin — Full access"},{value:"teacher",label:"Teacher — Limited access"},{value:"viewer",label:"Viewer — Read only"}]} />
            <Field label="Password" hint={editId ? "Leave blank to keep current password" : ""}>
              <div style={{ position: "relative" }}>
                <input type={showPwd ? "text" : "password"} value={form.password} onChange={f("password")} placeholder={editId ? "••••••••" : "Set password"} style={{ ...inputStyle, paddingRight: 40 }} />
                <button onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}>
                  <Icon name={showPwd ? "eyeOff" : "eye"} size={15} />
                </button>
              </div>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => { setShowAdd(false); setEditId(null); }}>Cancel</Btn>
            <Btn icon="save" onClick={addUser}>{editId ? "Save Changes" : "Create Account"}</Btn>
          </div>
        </div>
      )}

      {/* User list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {users.map(u => {
          const role = getRoleMeta(u.role);
          return (
            <div key={u.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              {/* Avatar */}
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg, ${u.color[0]}, ${u.color[1]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {u.initials}
              </div>
              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{u.name}</span>
                  <span style={{ background: role.dim, color: role.color, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>{role.label}</span>
                  {u.status === "inactive" && <span style={{ background: C.roseDim, color: C.rose, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>Inactive</span>}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{u.email}</div>
              </div>
              {/* Actions */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => toggleStatus(u.id)} disabled={loading} title={u.status === "active" ? "Deactivate" : "Activate"}
                  style={{ background: u.status === "active" ? C.greenDim : C.roseDim, border: "none", borderRadius: 8, padding: "6px 10px", cursor: loading ? "not-allowed" : "pointer", color: u.status === "active" ? C.green : C.rose, fontSize: 11, fontWeight: 700, opacity: loading ? 0.6 : 1 }}>
                  {u.status === "active" ? "Active" : "Inactive"}
                </button>
                <button onClick={() => startEdit(u)} disabled={loading} style={{ background: C.accentGlow, border: `1px solid ${C.accentDim}`, borderRadius: 8, padding: 7, cursor: loading ? "not-allowed" : "pointer", color: C.accent, opacity: loading ? 0.6 : 1 }}>
                  <Icon name="edit" size={13} />
                </button>
                <button onClick={() => deleteUser(u.id)} disabled={loading} style={{ background: C.roseDim, border: `1px solid ${C.rose}33`, borderRadius: 8, padding: 7, cursor: loading ? "not-allowed" : "pointer", color: C.rose, opacity: loading ? 0.6 : 1 }}>
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

UsersTab.propTypes = { onSave: PropTypes.func.isRequired, auth: PropTypes.object };

const PermissionsTab = ({ auth, onSave, onPermissionsSaved }) => {
  const defaultPermissions = useMemo(() => Object.fromEntries(
    Object.entries(ROLE).map(([role, cfg]) => [role, { edit: Boolean(cfg.edit), pages: Array.isArray(cfg.pages) ? [...cfg.pages] : [] }])
  ), []);

  const [permissions, setPermissions] = useState(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const allPages = useMemo(() => [...NAV, ...NAV_EXTRAS], []);
  const roles = useMemo(() => 
    Object.keys(defaultPermissions).filter(r => r !== "superadmin" && r !== "director"), 
    [defaultPermissions]
  );

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/settings/permissions", { token: auth?.token });
      setPermissions({ ...defaultPermissions, ...(data.permissions || {}) });
    } catch (err) {
      console.error("[permissions] Load failed", err.message || err);
      setMessage({ type: "error", text: err.message || "Failed to load permissions." });
      setPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth?.token) loadPermissions();
  }, [auth?.token]);

  const updateRole = (role, changes) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        ...changes,
      },
    }));
  };

  const togglePage = (role, pageId) => {
    const current = permissions[role]?.pages || [];
    const next = current.includes(pageId) ? current.filter(p => p !== pageId) : [...current, pageId];
    updateRole(role, { pages: next });
  };

  const save = async () => {
    setLoading(true);
    try {
      await apiFetch("/settings/permissions", {
        method: "PUT",
        token: auth?.token,
        body: { permissions },
      });
      setMessage({ type: "success", text: "Permissions saved successfully." });
      onSave();
      onPermissionsSaved?.();
    } catch (err) {
      console.error("[permissions] Save failed", err.message || err);
      setMessage({ type: "error", text: err.message || "Failed to save permissions." });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: C.textSub }}>Loading permissions...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: C.textSub }}>Role-based page access and edit permissions</div>
        <Btn icon="save" onClick={save}>Save Permissions</Btn>
      </div>

      {message && (
        <div style={{
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          background: message.type === "success" ? C.greenDim : C.roseDim,
          border: `1px solid ${message.type === "success" ? C.green : C.rose}44`,
          color: message.type === "success" ? C.green : C.rose,
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
        {roles.map(role => {
          const roleMeta = ROLE_META[role] || { label: role, color: C.textMuted, dim: C.surface };
          const rolePermissions = permissions[role] || defaultPermissions[role];
          return (
            <div key={role} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{roleMeta.label || role}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Manage pages and edit rights for {role} users.</div>
                </div>
                <Toggle value={Boolean(rolePermissions.edit)} onChange={value => updateRole(role, { edit: value })}
                  label="Can edit" description="Allow this role to create and modify records" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
                {allPages.map(page => {
                  const enabled = (rolePermissions.pages || []).includes(page.id);
                  return (
                    <label key={`${role}-${page.id}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, background: enabled ? "rgba(59,130,246,0.08)" : C.surface, border: `1px solid ${enabled ? "rgba(59,130,246,0.25)" : C.border}`, cursor: "pointer", color: C.text }}>
                      <input type="checkbox" checked={enabled} onChange={() => togglePage(role, page.id)} style={{ width: 16, height: 16 }} />
                      <span>{page.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
PermissionsTab.propTypes = { auth: PropTypes.object, onSave: PropTypes.func.isRequired, onPermissionsSaved: PropTypes.func };

// ─── SECURITY TAB ─────────────────────────────────────────────────────────────
const SecurityTab = ({ onSave }) => {
  const [form, setForm] = useState({ current: "", newPwd: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [toggles, setToggles] = useState({
    twoFactor: false,
    sessionTimeout: true,
    loginAlerts: true,
    passwordExpiry: false,
  });
  const f = k => e => setForm({ ...form, [k]: e.target.value });
  const t = k => v => setToggles({ ...toggles, [k]: v });

  const strength = pwd => {
    if (!pwd) return { label: "", color: C.border, width: 0 };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const levels = [
      { label: "Weak",   color: C.rose,  width: 25 },
      { label: "Fair",   color: C.amber, width: 50 },
      { label: "Good",   color: C.teal,  width: 75 },
      { label: "Strong", color: C.green, width: 100 },
    ];
    return levels[score - 1] || levels[0];
  };

  const str = strength(form.newPwd);

  const PwdField = ({ label, val, show, setShow, onChange, placeholder }) => (
    <Field label={label}>
      <div style={{ position: "relative" }}>
        <input type={show ? "text" : "password"} value={val} onChange={onChange} placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: 42 }} />
        <button onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}>
          <Icon name={show ? "eyeOff" : "eye"} size={15} />
        </button>
      </div>
    </Field>
  );

  return (
    <div>
      {/* Change password */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Change Password</div>
        <PwdField label="Current Password" val={form.current} show={showCurrent} setShow={setShowCurrent} onChange={f("current")} placeholder="Enter current password" />
        <PwdField label="New Password" val={form.newPwd} show={showNew} setShow={setShowNew} onChange={f("newPwd")} placeholder="Min 8 characters" />
        {form.newPwd && (
          <div style={{ marginBottom: 16, marginTop: -8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>Password strength</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: str.color }}>{str.label}</span>
            </div>
            <div style={{ background: C.border, borderRadius: 99, height: 5 }}>
              <div style={{ width: `${str.width}%`, background: str.color, borderRadius: 99, height: "100%", transition: "width 0.3s, background 0.3s" }} />
            </div>
          </div>
        )}
        <Field label="Confirm New Password">
          <input type="password" value={form.confirm} onChange={f("confirm")} placeholder="Re-enter new password"
            style={{ ...inputStyle, borderColor: form.confirm && form.confirm !== form.newPwd ? C.rose : C.border }} />
          {form.confirm && form.confirm !== form.newPwd && (
            <div style={{ fontSize: 11, color: C.rose, marginTop: 4 }}>Passwords do not match</div>
          )}
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4, marginBottom: 24 }}>
          <Btn icon="key" onClick={onSave}>Update Password</Btn>
        </div>
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: 20 }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Security Preferences</div>

      <Toggle value={toggles.twoFactor} onChange={t("twoFactor")} label="Two-Factor Authentication" description="Require a verification code on login" />
      <Toggle value={toggles.sessionTimeout} onChange={t("sessionTimeout")} label="Auto Session Timeout" description="Log out inactive sessions after 30 minutes" />
      <Toggle value={toggles.loginAlerts} onChange={t("loginAlerts")} label="Login Alerts" description="Send email when a new device logs in" />
      <Toggle value={toggles.passwordExpiry} onChange={t("passwordExpiry")} label="Password Expiry" description="Require password change every 90 days" />
    </div>
  );
};

const IntegrationsTab = ({ auth }) => {
  const [config, setConfig] = useState({
    mpesaShortcode: "", mpesaConsumerKey: "", mpesaConsumerSecret: "", mpesaPasskey: "",
    paystackPublicKey: "", paystackSecretKey: "",
    smsEnabled: false, smsSenderId: "",
    whatsappEnabled: false,
    whatsappApiUrl: "",
    whatsappPhoneNumberId: "",
    whatsappToken: "",
    whatsappBusinessAccountId: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    apiFetch("/payment-configs", { token: auth?.token })
      .then(res => {
        if (res.exists && res.config) {
          const c = res.config;
          setConfig(prev => ({
            ...prev,
            // M-Pesa
            mpesaShortcode: c.mpesa_shortcode || "",
            mpesaConsumerKey: c.mpesa_consumer_key || "",
            mpesaConsumerSecret: c.mpesa_consumer_secret || "",
            mpesaPasskey: c.mpesa_passkey || "",
            // Paystack
            paystackPublicKey: c.paystack_public_key || "",
            paystackSecretKey: c.paystack_secret_key || "",
            // SMS
            smsEnabled: c.sms_enabled || false,
            smsSenderId: c.sms_sender_id || "",
            // WhatsApp - map snake_case to camelCase
            whatsappEnabled: c.whatsapp_enabled || false,
            whatsappApiUrl: c.whatsapp_api_url || "",
            whatsappPhoneNumberId: c.whatsapp_phone_number_id || "",
            whatsappToken: c.whatsapp_token || "",
            whatsappBusinessAccountId: c.whatsapp_business_account_id || ""
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [auth]);

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      await apiFetch("/payment-configs", {
        method: "PUT",
        body: config,
        token: auth?.token
      });
      setMessage({ type: "success", text: "✅ Integration settings saved successfully!" });
    } catch (e) {
      setMessage({ type: "error", text: `❌ Save failed: ${e.message}` });
    }
    setSaving(false);
  };

  if (loading) return <div style={{ color: C.textSub }}>Loading settings...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* M-Pesa section */}
      <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💸</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>M-Pesa (Daraja API)</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Accept mobile money payments via STK Push</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <Inp label="Shortcode" value={config.mpesaShortcode || ""} onChange={e => setConfig({ ...config, mpesaShortcode: e.target.value })} placeholder="e.g. 174379" />
          <Inp label="Passkey" value={config.mpesaPasskey || ""} onChange={e => setConfig({ ...config, mpesaPasskey: e.target.value })} placeholder="Lipa Na M-Pesa Passkey" />
        </div>
        <Inp label="Consumer Key" value={config.mpesaConsumerKey || ""} onChange={e => setConfig({ ...config, mpesaConsumerKey: e.target.value })} />
        <Inp label="Consumer Secret" value={config.mpesaConsumerSecret || ""} onChange={e => setConfig({ ...config, mpesaConsumerSecret: e.target.value })} />
      </div>

      {/* Paystack section */}
      <div style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💳</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Paystack</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Accept Card, Bank Transfer, and Apple Pay</div>
          </div>
        </div>
        <Inp label="Public Key" value={config.paystackPublicKey || ""} onChange={e => setConfig({ ...config, paystackPublicKey: e.target.value })} placeholder="pk_test_..." />
        <Inp label="Secret Key" value={config.paystackSecretKey || ""} onChange={e => setConfig({ ...config, paystackSecretKey: e.target.value })} placeholder="sk_test_..." />
      </div>

      {/* WhatsApp section */}
      <div style={{ background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.15)", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📱</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>WhatsApp Business API</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Send payment receipts and notifications via WhatsApp</div>
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input 
              type="checkbox" 
              checked={config.whatsappEnabled || false}
              onChange={e => setConfig({ ...config, whatsappEnabled: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Enable WhatsApp messaging</span>
          </label>
        </div>

        {config.whatsappEnabled && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
              <Inp 
                label="Phone Number ID" 
                value={config.whatsappPhoneNumberId || ""} 
                onChange={e => setConfig({ ...config, whatsappPhoneNumberId: e.target.value })} 
                placeholder="e.g. 123456789012345" 
              />
              <Inp 
                label="Business Account ID (Optional)" 
                value={config.whatsappBusinessAccountId || ""} 
                onChange={e => setConfig({ ...config, whatsappBusinessAccountId: e.target.value })} 
                placeholder="e.g. 987654321098765" 
              />
            </div>
            <Inp 
              label="API Token" 
              type="password"
              value={config.whatsappToken || ""} 
              onChange={e => setConfig({ ...config, whatsappToken: e.target.value })} 
              placeholder="EAAB... (Meta/Facebook access token)"
            />
            <Inp 
              label="API URL (Optional)" 
              value={config.whatsappApiUrl || ""} 
              onChange={e => setConfig({ ...config, whatsappApiUrl: e.target.value })} 
              placeholder="https://graph.facebook.com/v18.0" 
            />
            <div style={{ marginTop: 12, padding: 12, background: C.surface, borderRadius: 8, fontSize: 11, color: C.textSub }}>
              <strong>How to get credentials:</strong>
              <ol style={{ margin: "8px 0 0 16px", padding: 0 }}>
                <li>Create a Meta Business account at business.facebook.com</li>
                <li>Set up WhatsApp Business API in the Meta Developer portal</li>
                <li>Copy the Phone Number ID and generate a permanent access token</li>
              </ol>
            </div>
          </>
        )}
      </div>

      {message && (
        <div style={{ padding: 14, borderRadius: 10, fontSize: 13, background: message.type === "success" ? "#064e3b" : "#450a0a", color: message.type === "success" ? "#6ee7b7" : "#fca5a5" }}>
          {message.text}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn icon="save" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Integrations"}</Btn>
      </div>
    </div>
  );
};
IntegrationsTab.propTypes = { auth: PropTypes.object };

SecurityTab.propTypes = { onSave: PropTypes.func.isRequired };

// ─── NOTIFICATIONS TAB ────────────────────────────────────────────────────────
const NotificationsTab = ({ onSave }) => {
  const [toggles, setToggles] = useState({
    feeReminders: true,
    attendanceAlerts: true,
    newStudentAlert: true,
    gradeUpdates: false,
    weeklyReport: true,
    smsEnabled: false,
    emailEnabled: true,
    systemUpdates: true,
  });
  const t = k => v => setToggles({ ...toggles, [k]: v });

  const groups = [
    {
      label: "Academic Alerts",
      items: [
        { key: "attendanceAlerts", label: "Attendance Alerts", desc: "Notify when a student is absent 3+ days in a row" },
        { key: "gradeUpdates",     label: "Grade Updates",     desc: "Notify when new results are entered" },
        { key: "weeklyReport",     label: "Weekly Summary",    desc: "Send a weekly performance digest every Friday" },
      ]
    },
    {
      label: "Finance Alerts",
      items: [
        { key: "feeReminders", label: "Fee Payment Reminders", desc: "Send reminders for pending fee balances" },
      ]
    },
    {
      label: "Admin Alerts",
      items: [
        { key: "newStudentAlert", label: "New Student Registered", desc: "Notify when a new student is added to the system" },
        { key: "systemUpdates",   label: "System Updates",         desc: "Get notified about new features and maintenance" },
      ]
    },
    {
      label: "Delivery Channels",
      items: [
        { key: "emailEnabled", label: "Email Notifications", desc: "Send notifications to the school's configured admin email" },
        { key: "smsEnabled",   label: "SMS Notifications",   desc: "Send SMS to registered phone number (charges apply)" },
      ]
    },
  ];

  return (
    <div>
      {groups.map(group => (
        <div key={group.label} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{group.label}</div>
          {group.items.map(item => (
            <Toggle key={item.key} value={toggles[item.key]} onChange={t(item.key)} label={item.label} description={item.desc} />
          ))}
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Btn icon="save" onClick={onSave}>Save Preferences</Btn>
      </div>
    </div>
  );
};

NotificationsTab.propTypes = { onSave: PropTypes.func.isRequired };

// ─── ADMIN SETTINGS PAGE ──────────────────────────────────────────────────────
export default function AdminSettings({ auth, initialTab, onPermissionsSaved }) {
  const [activeTab, setActiveTab] = useState(initialTab || "school");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const renderTab = () => {
    const save = () => showToast("Changes saved successfully!");
    switch (activeTab) {
      case "school":        return <SchoolInfoTab onSave={save} auth={auth} />;
      case "users":         return <UsersTab onSave={save} auth={auth} />;
      case "permissions":   return <PermissionsTab onSave={save} onPermissionsSaved={onPermissionsSaved} auth={auth} />;
      case "security":      return <SecurityTab onSave={save} />;
      case "notifications": return <NotificationsTab onSave={save} />;
      case "activity":      return <ActivityLogsTab auth={auth} />;
      case "backups":       return <BackupsTab auth={auth} />;
      case "integrations":  return <IntegrationsTab auth={auth} />;
      case "promotion":    return <PromotionChainTab auth={auth} />;
      default:              return null;
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", color: C.text }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6 }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
              background: active ? C.accentGlow : "transparent",
              color: active ? C.accent : C.textSub,
              outline: active ? `1px solid ${C.accentDim}` : "none",
              transition: "all 0.15s",
            }}>
              <Icon name={tab.icon} size={14} color={active ? C.accent : C.textMuted} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content in section card */}
      <Section
        title={TABS.find(t => t.id === activeTab)?.label}
        subtitle={{
          school:        "Manage your school's identity, contact info, and term dates",
          users:         "Control who can access the system and what they can do",
          security:      "Password management and login security settings",
          notifications: "Choose what alerts you receive and how they're delivered",
          activity:      "View a history of actions performed in the system",
          backups:       "Download or create database backups for safety",
          integrations:  "Connect M-Pesa, Paystack, and SMS gateways",
        }[activeTab]}
        icon={TABS.find(t => t.id === activeTab)?.icon}
      >
        {renderTab()}
      </Section>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
