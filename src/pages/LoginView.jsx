import { useState } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import { C, inputStyle } from "../lib/theme";

export default function LoginView({ users, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = e => {
    e.preventDefault();
    const match = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.status === "active");
    if (!match) {
      setError("Invalid credentials.");
      return;
    }
    setError("");
    onLogin(match);
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.bg }}>
      <form onSubmit={submit} style={{ width: 420, maxWidth: "94vw", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
        <h2 style={{ marginTop: 0, color: C.text }}>EduCore Login</h2>
        <Field label="Email"><input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@greenfield.ac.ke" /></Field>
        <Field label="Password"><input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} /></Field>
        {error && <div style={{ color: C.rose, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Btn type="submit">Sign In</Btn>
        <div style={{ marginTop: 12, color: C.textMuted, fontSize: 11 }}>admin/admin123, teacher/teacher123, viewer/viewer123</div>
      </form>
    </div>
  );
}

LoginView.propTypes = {
  users: PropTypes.array.isRequired,
  onLogin: PropTypes.func.isRequired,
};
