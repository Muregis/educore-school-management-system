import { useState } from "react";
import { saveSession } from "../lib/auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "https://educore-school-management-system.onrender.com/api";

/**
 * Invite-only "Create your school" form.
 * Requires inviteCode matching server SCHOOL_SIGNUP_INVITE_CODE.
 */
export default function SignupPage({ onSuccess, onGoLogin }) {
  const [schoolName, setSchoolName] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/onboarding/register-school`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          directorName: directorName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          inviteCode: inviteCode.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Signup failed");
      }
      if (!data.token || !data.user) {
        throw new Error("Invalid signup response");
      }
      saveSession({
        token: data.token,
        sessionId: data.sessionId || null,
        user: {
          ...data.user,
          school_id: data.user.schoolId,
          user_id: data.user.userId,
        },
      });
      try {
        localStorage.setItem("educore.activeSchool", String(data.user.schoolId));
      } catch {
        /* ignore */
      }
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || "Could not create school");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.logo}>E</div>
          <div>
            <div style={styles.title}>Create your school</div>
            <div style={styles.sub}>EduCore · invite-only workspace</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            School name
            <input
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Real Peak Education Centre"
              style={styles.input}
              autoComplete="organization"
            />
          </label>
          <label style={styles.label}>
            Your full name
            <input
              required
              value={directorName}
              onChange={(e) => setDirectorName(e.target.value)}
              placeholder="Director / head teacher name"
              style={styles.input}
              autoComplete="name"
            />
          </label>
          <label style={styles.label}>
            Work email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="director@yourschool.ac.ke"
              style={styles.input}
              autoComplete="email"
            />
          </label>
          <label style={styles.label}>
            Phone <span style={styles.optional}>(optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07xx…"
              style={styles.input}
              autoComplete="tel"
            />
          </label>
          <label style={styles.label}>
            Invite code
            <input
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Provided by EduCore"
              style={styles.input}
              autoComplete="off"
            />
          </label>
          <label style={styles.label}>
            Password
            <div style={{ position: "relative" }}>
              <input
                required
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                style={{ ...styles.input, paddingRight: 64 }}
                autoComplete="new-password"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={styles.showBtn}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error ? <div style={styles.error}>{error}</div> : null}

          <button type="submit" disabled={loading} style={styles.submit}>
            {loading ? "Creating…" : "Create school account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <button type="button" onClick={onGoLogin} style={styles.link}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "linear-gradient(160deg, #0b1220 0%, #121a2e 50%, #0d1526 100%)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "rgba(18, 28, 48, 0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
  },
  brand: { display: "flex", gap: 12, alignItems: "center", marginBottom: 24 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    display: "grid",
    placeItems: "center",
    fontWeight: 700,
    color: "#fff",
  },
  title: { color: "#f1f5f9", fontSize: 18, fontWeight: 600 },
  sub: { color: "#94a3b8", fontSize: 13, marginTop: 2 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  label: { display: "flex", flexDirection: "column", gap: 6, color: "#cbd5e1", fontSize: 13 },
  optional: { color: "#64748b", fontWeight: 400 },
  input: {
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "#f8fafc",
    fontSize: 14,
    outline: "none",
  },
  showBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
  },
  error: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.35)",
    color: "#fecaca",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
  },
  submit: {
    marginTop: 4,
    border: "none",
    borderRadius: 10,
    padding: "12px 16px",
    background: "linear-gradient(90deg, #f59e0b, #3b82f6)",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 15,
  },
  footer: { marginTop: 18, textAlign: "center", color: "#94a3b8", fontSize: 13 },
  link: {
    background: "none",
    border: "none",
    color: "#60a5fa",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
  },
};
