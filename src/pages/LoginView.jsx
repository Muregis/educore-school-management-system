import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { DEFAULTS } from "../lib/constants";

export default function LoginView({ users, onLogin }) {
  const [mode, setMode]           = useState("staff");
  const [email, setEmail]         = useState("");
  const [admission, setAdmission] = useState("");
  const [password, setPassword]   = useState("");
  const [portalRole, setPortalRole] = useState("parent");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  const submitStaff = async e => {
    e.preventDefault();
    setError(""); setLoading(true);

    // Try backend first
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password, schoolId: 1 }
      });
      onLogin({ id: data.user.userId, name: data.user.name, email: data.user.email, role: data.user.role, schoolId: data.user.schoolId, token: data.token, studentId: null });
      setLoading(false); return;
    } catch { /* fallback */ }

    // Local fallback — staff only
    const match = users.find(u =>
      u.email &&
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password &&
      u.status === "active" &&
      ["admin", "teacher"].includes(u.role)
    );
    if (!match) { setError("Invalid credentials."); setLoading(false); return; }
    onLogin(match);
    setLoading(false);
  };

  const submitPortal = async e => {
    e.preventDefault();
    setError(""); setLoading(true);
    const trimmed = admission.trim();

    // Try backend portal login
    try {
      const data = await apiFetch("/auth/portal-login", {
        method: "POST",
        body: { admissionNumber: trimmed, password, role: portalRole, schoolId: 1 }
      });
      onLogin({ id: data.user.userId, name: data.user.name, role: data.user.role, schoolId: data.user.schoolId, token: data.token, studentId: data.user.studentId, admission: trimmed });
      setLoading(false); return;
    } catch { /* fallback */ }

    // Local fallback — find student by admission number
    const student = DEFAULTS.students.find(s => s.admission === trimmed);
    if (!student) { setError("Admission number not found."); setLoading(false); return; }

    // Check password against demo portal users
    const portalUser = DEFAULTS.users.find(u =>
      u.admission === trimmed &&
      u.role === portalRole &&
      u.password === password &&
      u.status === "active"
    );
    if (!portalUser) { setError("Invalid password."); setLoading(false); return; }

    const name = portalRole === "parent"
      ? `${student.parentName || "Parent"} (${student.firstName} ${student.lastName})`
      : `${student.firstName} ${student.lastName}`;

    onLogin({ ...portalUser, name, studentId: student.id, admission: trimmed });
    setLoading(false);
  };

  const tabStyle = active => ({
    flex: 1, padding: "10px 0", border: "none",
    borderBottom: `2px solid ${active ? C.accent : "transparent"}`,
    background: "transparent", color: active ? C.accent : C.textMuted,
    fontWeight: active ? 700 : 400, cursor: "pointer", fontSize: 14,
  });

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg }}>
      <div style={{ width: 420, maxWidth: "94vw", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
        <h2 style={{ marginTop: 0, color: C.text, marginBottom: 4 }}>EduCore</h2>
        <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>Greenfield Academy School Portal</div>

        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
          <button style={tabStyle(mode === "staff")}  onClick={() => { setMode("staff");  setError(""); }}>Staff Login</button>
          <button style={tabStyle(mode === "portal")} onClick={() => { setMode("portal"); setError(""); }}>Parent / Student</button>
        </div>

        {mode === "staff" && (
          <form onSubmit={submitStaff}>
            <Field label="Email">
              <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@greenfield.ac.ke" autoComplete="email" />
            </Field>
            <Field label="Password">
              <input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <Btn type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Btn>
            <div style={{ marginTop: 12, color: C.textMuted, fontSize: 11 }}>
              Demo → admin@greenfield.ac.ke / admin123
            </div>
          </form>
        )}

        {mode === "portal" && (
          <form onSubmit={submitPortal}>
            <Field label="Admission Number">
              <input style={inputStyle} value={admission} onChange={e => setAdmission(e.target.value)} placeholder="e.g. ADM-2020-001" autoComplete="username" />
            </Field>
            <Field label="Password">
              <input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="I am a">
              <select style={inputStyle} value={portalRole} onChange={e => setPortalRole(e.target.value)}>
                <option value="parent">Parent / Guardian</option>
                <option value="student">Student</option>
              </select>
            </Field>
            {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <Btn type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Btn>
            <div style={{ marginTop: 12, color: C.textMuted, fontSize: 11 }}>
              Demo → ADM-2020-001 / parent123 (parent) · student123 (student)
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

LoginView.propTypes = {
  users: PropTypes.array.isRequired,
  onLogin: PropTypes.func.isRequired,
};