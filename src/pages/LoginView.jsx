import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";

// ── Polished school portal login ────────────────────────────────────────────
// Aesthetic: Refined dark — editorial split layout, gold accent, serif headline
// Left panel: school branding + features
// Right panel: login form, tab-switched

const GOLD   = "#C9A84C";
const GOLD_L = "#E8C96A";
const GOLD_D = "rgba(201,168,76,0.12)";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  .lv-root {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    font-family: 'DM Sans', sans-serif;
    background: #060A12;
  }

  /* ── Left panel ── */
  .lv-left {
    position: relative;
    background: linear-gradient(160deg, #0A1628 0%, #0F2040 60%, #0A1628 100%);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 48px 56px;
    overflow: hidden;
  }
  .lv-left-grid {
    position: absolute; inset: 0; opacity: 0.04;
    background-image:
      repeating-linear-gradient(0deg, transparent, transparent 48px, ${GOLD} 48px, ${GOLD} 49px),
      repeating-linear-gradient(90deg, transparent, transparent 48px, ${GOLD} 48px, ${GOLD} 49px);
  }
  .lv-left-glow {
    position: absolute; bottom: -120px; left: -120px;
    width: 480px; height: 480px; border-radius: 50%;
    background: radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%);
    pointer-events: none;
  }
  .lv-left-glow2 {
    position: absolute; top: -80px; right: -80px;
    width: 320px; height: 320px; border-radius: 50%;
    background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .lv-logo-row {
    position: relative; z-index: 2;
    display: flex; align-items: center; gap: 14px;
  }
  .lv-logo-mark {
    width: 48px; height: 48px; border-radius: 13px; flex-shrink: 0;
    background: linear-gradient(135deg, ${GOLD}, ${GOLD_L});
    display: flex; align-items: center; justify-content: center;
    font-family: 'Playfair Display', serif; font-weight: 700;
    font-size: 22px; color: #0A1628;
    box-shadow: 0 4px 20px rgba(201,168,76,0.3);
  }
  .lv-logo-text { line-height: 1.2; }
  .lv-logo-name {
    font-family: 'Playfair Display', serif;
    font-size: 20px; font-weight: 700; color: #F4F0E8;
    letter-spacing: -0.01em;
  }
  .lv-logo-sub { font-size: 11px; color: rgba(201,168,76,0.8); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1px; }

  .lv-hero { position: relative; z-index: 2; }
  .lv-hero-badge {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid rgba(201,168,76,0.25); border-radius: 100px;
    padding: 5px 14px; font-size: 11px; color: ${GOLD};
    letter-spacing: 0.1em; text-transform: uppercase;
    background: ${GOLD_D}; margin-bottom: 24px;
  }
  .lv-hero-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(32px, 3.5vw, 52px);
    font-weight: 700; line-height: 1.1;
    color: #F4F0E8; letter-spacing: -0.02em;
    margin-bottom: 18px;
  }
  .lv-hero-title em { color: ${GOLD}; font-style: italic; }
  .lv-hero-desc {
    font-size: 15px; color: #8BA4C0; line-height: 1.75;
    max-width: 400px; margin-bottom: 40px;
  }

  .lv-features { display: flex; flex-direction: column; gap: 16px; }
  .lv-feature {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 16px 18px; border-radius: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    transition: border-color 0.2s;
  }
  .lv-feature:hover { border-color: rgba(201,168,76,0.2); }
  .lv-feature-icon {
    width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  }
  .lv-feature-title { font-size: 13px; font-weight: 600; color: #D4CCBB; margin-bottom: 2px; }
  .lv-feature-desc  { font-size: 12px; color: #56708A; line-height: 1.5; }

  .lv-footer-left {
    position: relative; z-index: 2;
    font-size: 11px; color: #2D4060; letter-spacing: 0.04em;
  }
  .lv-footer-left span { color: rgba(201,168,76,0.5); }

  /* ── Right panel ── */
  .lv-right {
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    padding: 48px 40px;
    background: #060A12;
    border-left: 1px solid rgba(26,42,66,0.8);
  }
  .lv-form-wrap {
    width: 100%; max-width: 420px;
  }
  .lv-form-title {
    font-family: 'Playfair Display', serif;
    font-size: 28px; font-weight: 700; color: #E2EAF8;
    margin-bottom: 6px; letter-spacing: -0.01em;
  }
  .lv-form-sub { font-size: 14px; color: #3D5070; margin-bottom: 32px; }

  /* Tabs */
  .lv-tabs {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 6px; margin-bottom: 28px;
    background: #0B1120; border-radius: 11px; padding: 5px;
    border: 1px solid #1A2A42;
  }
  .lv-tab {
    padding: 9px 0; border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.2s; letter-spacing: 0.02em;
  }
  .lv-tab-active {
    background: linear-gradient(135deg, ${GOLD}, ${GOLD_L});
    color: #0A1628;
    box-shadow: 0 2px 12px rgba(201,168,76,0.25);
  }
  .lv-tab-inactive { background: transparent; color: #3D5070; }
  .lv-tab-inactive:hover { color: #7A92B8; }

  /* Fields */
  .lv-field { margin-bottom: 16px; }
  .lv-label {
    display: block; font-size: 11px; font-weight: 700;
    color: #3D5070; text-transform: uppercase;
    letter-spacing: 0.08em; margin-bottom: 7px;
  }
  .lv-input {
    width: 100%; background: #0B1120;
    border: 1px solid #1A2A42; border-radius: 10px;
    padding: 11px 14px; color: #E2EAF8; font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }
  .lv-input:focus {
    border-color: ${GOLD};
    box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
  }
  .lv-input::placeholder { color: #2A3F60; }
  select.lv-input { cursor: pointer; }
  option { background: #0B1120; }

  /* Role pills */
  .lv-role-pills { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .lv-pill {
    padding: 9px 0; border-radius: 9px; border: 1px solid #1A2A42;
    font-size: 13px; font-weight: 600; cursor: pointer; text-align: center;
    transition: all 0.15s; background: #0B1120; color: #3D5070;
  }
  .lv-pill:hover { border-color: #2A3F60; color: #7A92B8; }
  .lv-pill-active {
    border-color: ${GOLD}44 !important;
    background: ${GOLD_D} !important;
    color: ${GOLD} !important;
  }

  /* Submit */
  .lv-submit {
    width: 100%; padding: 13px; border: none; border-radius: 10px;
    background: linear-gradient(135deg, ${GOLD}, ${GOLD_L});
    color: #0A1628; font-size: 15px; font-weight: 700;
    cursor: pointer; letter-spacing: 0.02em;
    transition: transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 20px rgba(201,168,76,0.2);
    margin-top: 8px; font-family: 'DM Sans', sans-serif;
  }
  .lv-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 28px rgba(201,168,76,0.3);
  }
  .lv-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .lv-error {
    background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.25);
    border-radius: 8px; padding: 10px 14px;
    color: #F87171; font-size: 13px; margin-bottom: 14px;
  }
  .lv-hint {
    margin-top: 16px; padding: 12px 14px; border-radius: 8px;
    background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.12);
    font-size: 11px; color: #3D5070; line-height: 1.7;
  }
  .lv-hint strong { color: #4A6080; }

  /* Mobile */
  @media (max-width: 768px) {
    .lv-root { grid-template-columns: 1fr; }
    .lv-left { display: none; }
    .lv-right { padding: 32px 24px; min-height: 100vh; }
    .lv-mobile-header {
      display: flex !important;
      align-items: center; gap: 12px; margin-bottom: 36px;
    }
  }
  @media (min-width: 769px) {
    .lv-mobile-header { display: none; }
  }
`;

const FEATURES = [
  { icon: "📊", bg: "rgba(59,130,246,0.12)",  title: "Academic Reports",   desc: "Grades, results & report cards in real-time" },
  { icon: "💳", bg: "rgba(201,168,76,0.12)",  title: "Fee Payments",       desc: "Pay via M-Pesa or card, view receipts instantly" },
  { icon: "✓",  bg: "rgba(34,197,94,0.12)",  title: "Attendance Tracking", desc: "Daily attendance records for every student" },
  { icon: "💬", bg: "rgba(168,85,247,0.12)", title: "Direct Communication", desc: "Messages and updates from teachers & admin" },
];

export default function LoginView({ onLogin }) {
  const [mode, setMode]             = useState("staff");
  const [email, setEmail]           = useState("");
  const [admission, setAdmission]   = useState("");
  const [password, setPassword]     = useState("");
  const [schoolId, setSchoolId]     = useState("");
  const [portalRole, setPortalRole] = useState("parent");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [schoolInfo, setSchoolInfo] = useState({ name: "EduCore School", motto: "Student & Parent Portal" });
  const [discoveredSchools, setDiscoveredSchools] = useState([]); // Array of {id, name, motto}

  const lookup = async (id, currentMode) => {
    if (!id || id.length < 3) return;
    try {
      const res = await apiFetch(`/auth/lookup-school?loginId=${encodeURIComponent(id)}&role=${currentMode}`);
      if (res.schools?.length === 1) {
        setSchoolId(res.schools[0].id);
        setSchoolInfo({ name: res.schools[0].name, motto: res.schools[0].motto });
        setDiscoveredSchools([]);
      } else if (res.schools?.length > 1) {
        setDiscoveredSchools(res.schools);
      }
    } catch (e) { /* silent */ }
  };

  const fetchSchoolName = async (id) => {
    try {
      const res = await apiFetch(`/auth/school-info/${id}`);
      if (res.name) setSchoolInfo({ name: res.name, motto: res.motto || "Student & Parent Portal" });
    } catch (e) { /* fallback */ }
  };

  // Inject CSS once
  useEffect(() => {
    const id = "lv-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = style;
      document.head.appendChild(el);
    }

    // NEW: Capture school ID from URL (?school=101)
    const params = new URLSearchParams(window.location.search);
    const sId = params.get("school") || params.get("s");
    if (sId) {
      setSchoolId(sId);
      fetchSchoolName(sId);
    }

    return () => {};
  }, []);

  const submitStaff = async e => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const numericSchoolId = Number(schoolId);
      if (!schoolId || Number.isNaN(numericSchoolId)) {
        throw new Error("Could not identify your school. Please check your email or contact support.");
      }
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password, schoolId: numericSchoolId }, // Explicit tenant required
      });
      onLogin({
        id: data.user.userId, name: data.user.name,
        email: data.user.email ?? email, role: data.user.role,
        schoolId: data.user.schoolId, token: data.token, studentId: null,
      });
    } catch (err) { setError(err.message || "Login failed"); }
    setLoading(false);
  };

  const submitPortal = async e => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const numericSchoolId = Number(schoolId);
      if (!schoolId || Number.isNaN(numericSchoolId)) {
        throw new Error("Please verify your admission number or select your school.");
      }
      const data = await apiFetch("/auth/portal-login", {
        method: "POST",
        body: { admissionNumber: admission.trim(), password, role: portalRole, schoolId }, // Pass schoolId if pre-filled
      });
      onLogin({
        id: data.user.userId, name: data.user.name,
        role: data.user.role, schoolId: data.user.schoolId,
        token: data.token, studentId: data.user.studentId,
        admission: admission.trim(),
        feeBlocked: data.feeBlocked ?? false,
      });
    } catch (err) { setError(err.message || "Login failed"); }
    setLoading(false);
  };

  return (
    <div className="lv-root">
      <style>{style}</style>

      {/* ── Left panel ── */}
      <div className="lv-left">
        <div className="lv-left-grid" />
        <div className="lv-left-glow" />
        <div className="lv-left-glow2" />

        {/* Logo */}
        <div className="lv-logo-row">
          <div className="lv-logo-mark">{schoolInfo.name.charAt(0)}</div>
          <div className="lv-logo-text">
            <div className="lv-logo-name">{schoolInfo.name}</div>
            <div className="lv-logo-sub">{schoolInfo.motto}</div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="lv-hero">
          <div className="lv-hero-badge">🎓 Established 2010 · Nairobi, Kenya</div>
          <h1 className="lv-hero-title">
            Your child's education,<br /><em>at your fingertips.</em>
          </h1>
          <p className="lv-hero-desc">
            Access grades, fees, attendance, and school updates anytime —
            from any device. Stay connected with Greenfield Academy.
          </p>

          <div className="lv-features">
            {FEATURES.map(f => (
              <div className="lv-feature" key={f.title}>
                <div className="lv-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
                <div>
                  <div className="lv-feature-title">{f.title}</div>
                  <div className="lv-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lv-footer-left">
          Powered by <span>EduCore</span> · © 2026 Greenfield Academy
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="lv-right">
        <div className="lv-form-wrap">

          {/* Mobile-only header */}
          <div className="lv-mobile-header" style={{ display: "none" }}>
            <div className="lv-logo-mark" style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(135deg, ${GOLD}, ${GOLD_L})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: "#0A1628",
            }}>G</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#E2EAF8" }}>Greenfield Academy</div>
              <div style={{ fontSize: 11, color: "rgba(201,168,76,0.8)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Student & Parent Portal</div>
            </div>
          </div>

            <div className="lv-form-title">Welcome back</div>
            <div className="lv-form-sub">Sign in to access your school portal</div>

          {/* Tabs */}
          <div className="lv-tabs">
            <button
              className={`lv-tab ${mode === "staff" ? "lv-tab-active" : "lv-tab-inactive"}`}
              onClick={() => { setMode("staff"); setError(""); setDiscoveredSchools([]); }}
            >Staff Login</button>
            <button
              className={`lv-tab ${mode === "portal" ? "lv-tab-active" : "lv-tab-inactive"}`}
              onClick={() => { setMode("portal"); setError(""); setDiscoveredSchools([]); }}
            >Parent / Student</button>
          </div>

          {/* Multiple schools found selector */}
          {discoveredSchools.length > 1 && (
            <div style={{ marginBottom: 20, padding: 12, background: "rgba(59,130,246,0.1)", borderRadius: 10, border: "1px solid #3B82F644" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", marginBottom: 8, textTransform: "uppercase" }}>Please select your school:</div>
              <select className="lv-input" style={{ background: "#0E1420" }} 
                onChange={e => {
                  const s = discoveredSchools.find(sc => sc.id === Number(e.target.value));
                  if (s) { setSchoolId(s.id); setSchoolInfo({ name: s.name, motto: s.motto }); }
                }}>
                <option value="">-- Select School --</option>
                {discoveredSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Staff form */}
          {mode === "staff" && (
            <form onSubmit={submitStaff}>
              <div className="lv-field">
                <label className="lv-label">Email address</label>
                <input className="lv-input" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); lookup(e.target.value, "staff"); }}
                  placeholder="you@school.ac.ke" autoComplete="email" />
              </div>
              <div className="lv-field">
                <label className="lv-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input className="lv-input" type={showPass ? "text" : "password"}
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password" style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#3D5070", cursor: "pointer", fontSize: 16,
                  }}>{showPass ? "🙈" : "👁"}</button>
                </div>
              </div>
              {error && <div className="lv-error">⚠ {error}</div>}
              <button className="lv-submit" type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign In →"}
              </button>
            </form>
          )}

          {/* Portal form */}
          {mode === "portal" && (
            <form onSubmit={submitPortal}>
              <div className="lv-field">
                <label className="lv-label">I am a</label>
                <div className="lv-role-pills">
                  {[["parent","👨‍👩‍👧 Parent"],["student","🎒 Student"]].map(([val, label]) => (
                    <button key={val} type="button"
                      className={`lv-pill ${portalRole === val ? "lv-pill-active" : ""}`}
                      onClick={() => setPortalRole(val)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="lv-field">
                <label className="lv-label">Admission Number</label>
                <input className="lv-input" value={admission}
                  onChange={e => { setAdmission(e.target.value); lookup(e.target.value, "portal"); }}
                  placeholder="e.g. ADM-2020-001" autoComplete="username" />
              </div>
              <div className="lv-field">
                <label className="lv-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input className="lv-input" type={showPass ? "text" : "password"}
                    value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password" style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#3D5070", cursor: "pointer", fontSize: 16,
                  }}>{showPass ? "🙈" : "👁"}</button>
                </div>
              </div>
              {error && <div className="lv-error">⚠ {error}</div>}
              <button className="lv-submit" type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Access Portal →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

LoginView.propTypes = { onLogin: PropTypes.func.isRequired };
