import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import { C, inputStyle } from "../lib/theme";

const API_BASE = "http://localhost:4000/api";

export default function LoginView({ users, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleHint, setRoleHint] = useState("auto");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const roleOptions = useMemo(() => ["auto", ...Array.from(new Set(users.map(u => u.role)))], [users]);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, schoolId: 1 })
      });

      if (res.ok) {
        const data = await res.json();
        setError("");
        onLogin({
          id: data.user.userId,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          schoolId: data.user.schoolId,
          token: data.token
        });
        return;
      }
    } catch {
      // Backend fallback to local login.
    }

    const matches = users.filter(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.status === "active");
    const picked = roleHint === "auto" ? matches[0] : matches.find(u => u.role === roleHint);
    if (!picked) {
      setError("Invalid credentials.");
      setLoading(false);
      return;
    }

    setError("");
    onLogin(picked);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg }}>
      <form onSubmit={submit} style={{ width: 420, maxWidth: "94vw", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
        <h2 style={{ marginTop: 0, color: C.text }}>EduCore Login</h2>
        <Field label="Email"><input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@greenfield.ac.ke" /></Field>
        <Field label="Password"><input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <Field label="Login As"><select style={inputStyle} value={roleHint} onChange={e => setRoleHint(e.target.value)}>{roleOptions.map(r => <option key={r} value={r}>{r}</option>)}</select></Field>
        {error && <div style={{ color: C.rose, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Btn type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Btn>
        <div style={{ marginTop: 12, color: C.textMuted, fontSize: 11 }}>Family shared login: family@greenfield.ac.ke / family123</div>
      </form>
    </div>
  );
}

LoginView.propTypes = {
  users: PropTypes.array.isRequired,
  onLogin: PropTypes.func.isRequired,
};
