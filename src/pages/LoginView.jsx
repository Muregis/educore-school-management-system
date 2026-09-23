import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";

const DEFAULT_BRANDING = {
  school_id: null,
  name: "EduCore",
  tagline: "Student & Parent Portal",
  motto: "Student & Parent Portal",
  location: "Multi-school platform",
  established_year: null,
  logo_url: null,
  primary_color: "#C9A84C",
  secondary_color: "#3B82F6",
  hero_message: "Access grades, fees, attendance, and school updates from one secure portal.",
  schoolOptions: [],
  ambiguous: false,
  notFound: true,
};

const FEATURES = [
  {
    title: "Academic Reports",
    desc: "Grades and report cards in one place.",
    icon: "AR",
  },
  {
    title: "Fee Payments",
    desc: "Track balances and complete payments online.",
    icon: "FP",
  },
  {
    title: "Attendance Tracking",
    desc: "Mark and view daily attendance.",
    icon: "AT",
  },
  {
    title: "School Communication",
    desc: "Receive announcements and updates from staff.",
    icon: "SC",
  },
];

function getInitialSchoolId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("school") || params.get("s") || "";
}

function buildResolveSchoolPath({ hostname, loginId, selectedSchoolId, role }) {
  const params = new URLSearchParams();
  if (hostname) params.set("hostname", hostname);
  if (loginId) params.set("loginId", loginId);
  if (selectedSchoolId) params.set("selectedSchoolId", selectedSchoolId);
  if (role) params.set("role", role);
  return `/auth/resolve-school?${params.toString()}`;
}

function SchoolMark({ branding, small = false }) {
  const size = small ? 44 : 56;
  const fontSize = small ? 18 : 24;
  const initial = String(branding?.name || "E").charAt(0).toUpperCase();

  if (branding?.logo_url) {
    return (
      <img
        src={branding.logo_url}
        alt={`${branding.name} logo`}
        style={{
          width: size,
          height: size,
          borderRadius: small ? 12 : 16,
          objectFit: "cover",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: small ? 12 : 16,
        background: "linear-gradient(135deg, var(--primary-color), var(--secondary-color))",
        color: "#08111f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Playfair Display', serif",
        fontWeight: 800,
        fontSize,
        boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
      }}
    >
      {initial}
    </div>
  );
}

SchoolMark.propTypes = {
  branding: PropTypes.object,
  small: PropTypes.bool,
};

export default function LoginView({ onLogin }) {
  const [mode, setMode] = useState("staff");
  const [email, setEmail] = useState("");
  const [admission, setAdmission] = useState("");
  const [password, setPassword] = useState("");
  const [portalRole, setPortalRole] = useState("parent");
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [tenantReady, setTenantReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [tempSessionId, setTempSessionId] = useState("");
  const [passwordChangeToken, setPasswordChangeToken] = useState("");
  const [passwordChangeReasons, setPasswordChangeReasons] = useState([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const lastResolvedIdentifierRef = useRef("");
  const lastResolveRoleRef = useRef("");

  useEffect(() => {
    setEmail("");
    setPassword("");
    setAdmission("");
  }, []);

  const [randomFieldSuffix] = useState(() => Math.random().toString(36).substring(2, 15));

  const activeIdentifier = mode === "staff" ? email : admission;
  const schoolOptions = branding.schoolOptions || [];

  function shouldResolveIdentifier(identifier, currentMode, currentPortalRole) {
    const trimmed = String(identifier || "").trim();
    if (!trimmed) return false;
    if (currentMode === "staff") {
      return trimmed.includes("@") && trimmed.includes(".");
    }
    if (currentPortalRole === "student") {
      return trimmed.length >= 4;
    }
    return trimmed.length >= 6;
  }

  useEffect(() => {
    let cancelled = false;
    async function primeBranding() {
      try {
        const hostname = window.location.hostname;
        const res = await apiFetch(buildResolveSchoolPath({
          hostname,
          role: mode === "portal" ? portalRole : "staff",
        }));
        if (!cancelled) {
          setBranding({ ...DEFAULT_BRANDING, ...res, schoolOptions: res.schoolOptions || [] });
        }
      } catch (_err) {
        if (!cancelled) setBranding(DEFAULT_BRANDING);
      } finally {
        if (!cancelled) setTenantReady(true);
      }
    }
    primeBranding();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!tenantReady) return undefined;
    const trimmedIdentifier = String(activeIdentifier || "").trim();
    const currentRole = mode === "portal" ? portalRole : "staff";
    if (!trimmedIdentifier) {
      lastResolvedIdentifierRef.current = "";
      lastResolveRoleRef.current = "";
      setBranding(prev => ({ ...DEFAULT_BRANDING, ...prev, schoolOptions: [] }));
      return undefined;
    }
    if (!shouldResolveIdentifier(trimmedIdentifier, mode, portalRole)) {
      return undefined;
    }
    if (
      lastResolvedIdentifierRef.current === trimmedIdentifier &&
      lastResolveRoleRef.current === currentRole
    ) {
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const resolvePath = buildResolveSchoolPath({
          hostname: window.location.hostname,
          loginId: trimmedIdentifier,
          role: currentRole,
        });
        const res = await apiFetch(resolvePath);
        const newBranding = { ...DEFAULT_BRANDING, ...res, schoolOptions: res.schoolOptions || [] };
        lastResolvedIdentifierRef.current = trimmedIdentifier;
        lastResolveRoleRef.current = currentRole;
        setBranding(newBranding);
      } catch (err) {
        if (err?.status === 429) return;
        setBranding(DEFAULT_BRANDING);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeIdentifier, portalRole, mode, tenantReady]);

  const themeStyle = useMemo(() => ({
    "--primary-color": branding.primary_color || DEFAULT_BRANDING.primary_color,
    "--secondary-color": branding.secondary_color || DEFAULT_BRANDING.secondary_color,
    minHeight: "100vh",
    background: "radial-gradient(circle at top left, rgba(255,255,255,0.06), transparent 28%), linear-gradient(145deg, #07111d, #0a1628 58%, #0f1f36)",
    color: "#edf4ff",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  }), [branding.primary_color, branding.secondary_color]);

  async function submitStaff(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const raw = await apiFetch("/auth/login", {
        method: "POST",
        body: {
          email: String(email || "").trim().toLowerCase(),
          password,
          schoolId: branding.schoolId || branding.school_id || null,
        },
      });
      const nested = raw?.data && typeof raw.data === "object" ? raw.data : {};
      const data = { ...nested, ...(raw && typeof raw === "object" ? raw : {}) };
      if (data.data) delete data.data;

      if (data?.twoFactorRequired) {
        setTempToken(data.tempToken);
        setTempSessionId(data.tempSessionId);
        setTwoFactorRequired(true);
        setLoading(false);
        return;
      }

      const changeTok =
        data?.changeToken ||
        data?.change_token ||
        data?.passwordChangeToken ||
        nested?.changeToken;
      const mustChangeFlag =
        data?.requires_password_change ||
        data?.passwordChangeRequired ||
        data?.password_change_required ||
        nested?.requires_password_change;
      const mustChange = Boolean(mustChangeFlag || (changeTok && !data?.token));

      if (mustChange) {
        if (!changeTok) {
          throw new Error(
            data?.message ||
              "Password change is required, but the server did not return a change token. Try again or contact support."
          );
        }
        setPasswordChangeToken(changeTok);
        setPasswordChangeReasons(
          data.policyViolation || data.errors || data.passwordChangeReasons || []
        );
        setError("");
        setNotice(
          data.message ||
            "Your current password does not meet policy. Set a new password to continue."
        );
        setMode("passwordChange");
        setLoading(false);
        return;
      }

      if (!data?.token || !data?.user) {
        const hint = data?.message ? ` Server said: ${data.message}` : "";
        throw new Error(
          "Login succeeded but the server response was missing session data." + hint
        );
      }
      onLogin({
        id: data.user.userId,
        name: data.user.name,
        email: data.user.email ?? email,
        role: data.user.role,
        schoolId: data.user.schoolId,
        token: data.token,
        sessionId: data.sessionId,
      });
      setEmail("");
      setPassword("");
    } catch (err) {
      const body = err?.body || {};
      const changeTok =
        body.changeToken || body.change_token || body.passwordChangeToken;
      const mustChange =
        body.requires_password_change ||
        body.passwordChangeRequired ||
        body.password_change_required ||
        (err?.status === 403 && changeTok);

      if (mustChange && changeTok) {
        setPasswordChangeToken(changeTok);
        setPasswordChangeReasons(body.policyViolation || body.errors || []);
        setError("");
        setNotice(body.message || "Please set a new password to continue.");
        setMode("passwordChange");
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordChange(event) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        token: passwordChangeToken,
        body: { currentPassword: password, newPassword },
      });
      setPasswordChangeToken("");
      setPasswordChangeReasons([]);
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
      setMode("staff");
      setNotice("Password updated. Please sign in with your new password.");
    } catch (err) {
      const details = err.body?.errors?.join(", ");
      setError(details || err.message || "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  async function submitTwoFactor(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const raw = await apiFetch("/auth/verify-2fa", {
        method: "POST",
        headers: { Authorization: `Bearer ${tempToken}` },
        body: { token: twoFactorToken },
      });
      const data = raw?.data || raw;
      if (!data?.token || !data?.user) {
        throw new Error("2FA verification succeeded but the server response was missing session data.");
      }
      onLogin({
        id: data.user.userId,
        name: data.user.name,
        email: data.user.email ?? email,
        role: data.user.role,
        schoolId: data.user.schoolId,
        token: data.token,
        sessionId: data.sessionId,
        studentId: null,
      });
      setTwoFactorToken("");
      setTempToken("");
      setTempSessionId("");
      setTwoFactorRequired(false);
    } catch (err) {
      setError(err.message || "2FA verification failed");
      setTwoFactorToken("");
    } finally {
      setLoading(false);
    }
  }

  async function submitPortal(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const raw = await apiFetch("/auth/portal-login", {
        method: "POST",
        body: {
          admissionNumber: admission.trim(),
          password,
          role: portalRole,
        },
      });
      const data = raw?.data || raw;
      if (!data?.token || !data?.user) {
        throw new Error("Login succeeded but the server response was missing session data.");
      }
      onLogin({
        id: data.user.userId,
        name: data.user.name,
        role: data.user.role,
        schoolId: data.user.schoolId,
        token: data.token,
        sessionId: data.sessionId,
        studentId: data.user.studentId,
        admission: admission.trim(),
        feeBlocked: data.feeBlocked ?? false,
      });
      setAdmission("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (!tenantReady) {
    return (
      <div style={{ ...themeStyle, display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ width: "min(480px, 92vw)", borderRadius: 28, padding: 32, background: "rgba(7,17,29,0.82)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 18px", border: "3px solid rgba(255,255,255,0.12)", borderTopColor: "var(--primary-color)", animation: "lv-spin 0.9s linear infinite" }} />
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Loading school portal</div>
          <div style={{ color: "#8fa4c6", fontSize: 14 }}>Preparing the correct tenant branding and sign-in experience.</div>
          <style>{"@keyframes lv-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={themeStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.05fr) minmax(320px, 0.95fr)", minHeight: "100vh" }}>
        <section style={{ padding: "48px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
              <SchoolMark branding={branding} />
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700 }}>{branding.name}</div>
                <div style={{ color: "var(--primary-color)", textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 11, marginTop: 4 }}>{branding.tagline}</div>
              </div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--primary-color)", fontSize: 12, fontWeight: 700, marginBottom: 24 }}>
              <span>{branding.location}</span>
              {branding.established_year ? <span>· Since {branding.established_year}</span> : null}
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 4vw, 60px)", lineHeight: 1.05, margin: 0, maxWidth: 620 }}>
              {branding.name}
              <br />
              <span style={{ color: "var(--primary-color)", fontStyle: "italic" }}>{branding.tagline}</span>
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: "#99abc6", maxWidth: 520, marginTop: 20 }}>
              {branding.hero_message}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 32 }}>
              {FEATURES.map(feature => (
                <div key={feature.title} style={{ padding: 14, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--primary-color)", fontSize: 16, marginBottom: 8 }}>{feature.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{feature.title}</div>
                  <div style={{ color: "#88a0bf", fontSize: 12, lineHeight: 1.5 }}>{feature.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ color: "#6d819d", fontSize: 12 }}>
            Powered by <span style={{ color: "var(--primary-color)" }}>EduCore</span> · Tenant-aware secure login
          </div>
        </section>

        <section style={{ display: "grid", placeItems: "center", padding: "40px 24px" }}>
          <div style={{ width: "min(100%, 440px)", background: "rgba(7,17,29,0.86)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, padding: 30, boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <SchoolMark branding={branding} small />
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700 }}>{branding.notFound ? "Welcome to EduCore" : branding.name}</div>
                <div style={{ color: "#8ea3c4", fontSize: 13 }}>{branding.notFound ? "Sign in to locate your school workspace." : branding.tagline}</div>
              </div>
            </div>

            {!passwordChangeToken ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 6, marginBottom: 24 }}>
              {[
                { id: "staff", label: "Staff Login" },
                { id: "portal", label: "Parent / Student" },
              ].map(tab => {
                const active = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setMode(tab.id); setError(""); }}
                    style={{
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: active ? "linear-gradient(135deg, var(--primary-color), var(--secondary-color))" : "transparent",
                      color: active ? "#08111f" : "#d7e4fb",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            ) : null}

             <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
               {notice ? (
                 <div style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(34,197,94,0.12)", color: "#86efac", fontSize: 13 }}>
                   {notice}
                 </div>
               ) : null}

               {passwordChangeToken ? (
                 <form onSubmit={submitPasswordChange} style={{ display: "flex", flexDirection: "column", gap: 14 }} autoComplete="off">
                   <div style={{ textAlign: "center" }}>
                     <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Password Update Required</div>
                     <div style={{ fontSize: 13, marginTop: 4, color: "#cbd5f5" }}>
                       {passwordChangeReasons.length ? passwordChangeReasons.join(". ") : "Your password does not meet the school's security policy. Set a new password to continue."}
                     </div>
                   </div>
                   <label style={labelStyle}>
                     <span style={labelTextStyle}>New password</span>
                     <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" autoComplete="new-password" style={fieldStyle} />
                   </label>
                   <label style={labelStyle}>
                     <span style={labelTextStyle}>Confirm new password</span>
                     <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" style={fieldStyle} />
                   </label>
                   {error ? (
                     <div style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 13 }}>{error}</div>
                   ) : null}
                   <SubmitButton loading={loading} text="Update Password" />
                 </form>
               ) : twoFactorRequired ? (
                 <form onSubmit={submitTwoFactor} style={{ display: "flex", flexDirection: "column", gap: 14 }} autoComplete="off">
                   <div style={{ textAlign: "center", marginBottom: "8px" }}>
                     <div style={{ fontSize: "12px", color: "#8ea3c4", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Two-Factor Authentication</div>
                     <div style={{ fontSize: "13px", color: "#8ea3c4", marginTop: "4px" }}>Enter the 6-digit code from your authenticator app</div>
                   </div>
                   <label style={labelStyle}>
                     <span style={labelTextStyle}>Verification Code</span>
                     <input
                       value={twoFactorToken}
                       onChange={(e) => setTwoFactorToken(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                       type="text"
                       inputMode="numeric"
                       autoComplete="off"
                       placeholder="123456"
                       style={fieldStyle}
                       maxLength={6}
                     />
                   </label>
                   {error ? (
                     <div style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 13 }}>{error}</div>
                   ) : null}
                   <SubmitButton loading={loading} text="Verify" />
                 </form>
               ) : mode === "staff" ? (
                 <form onSubmit={submitStaff} style={{ display: "flex", flexDirection: "column", gap: 14 }} autoComplete="off">
                  <input type="text" name="fake_username" style={{ display: "none" }} autoComplete="off" />
                  <input type="password" name="fake_password" style={{ display: "none" }} autoComplete="off" />
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Email address</span>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="username"
                      name={`email_${randomFieldSuffix}`}
                      placeholder="you@school.ac.ke"
                      style={fieldStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Password</span>
                    <div style={{ position: "relative" }}>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        name={`password_${randomFieldSuffix}`}
                        style={{ ...fieldStyle, paddingRight: 64 }}
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#8ea3c4", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{showPassword ? "Hide" : "Show"}</button>
                    </div>
                  </label>
                  {schoolOptions.length > 1 ? (
                    <label style={labelStyle}>
                      <span style={labelTextStyle}>School</span>
                      <select
                        value={branding.schoolId || branding.school_id || ""}
                        onChange={(e) => setBranding(prev => ({ ...prev, schoolId: e.target.value, school_id: e.target.value }))}
                        style={fieldStyle}
                      >
                        <option value="">Select school</option>
                        {schoolOptions.map(opt => (
                          <option key={opt.schoolId || opt.school_id} value={opt.schoolId || opt.school_id}>{opt.schoolName || opt.name || opt.schoolId}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {error ? (
                    <div style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 13 }}>{error}</div>
                  ) : null}
                  <SubmitButton loading={loading} text="Sign In" />
                </form>
               ) : (
                 <form onSubmit={submitPortal} style={{ display: "flex", flexDirection: "column", gap: 14 }} autoComplete="off">
                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                     {["parent", "student"].map(role => (
                       <button
                         key={role}
                         type="button"
                         onClick={() => setPortalRole(role)}
                         style={{
                           border: "none",
                           borderRadius: 10,
                           padding: "10px 12px",
                           background: portalRole === role ? "linear-gradient(135deg, var(--primary-color), var(--secondary-color))" : "rgba(255,255,255,0.04)",
                           color: portalRole === role ? "#08111f" : "#d7e4fb",
                           fontWeight: 700,
                           cursor: "pointer",
                           textTransform: "capitalize",
                         }}
                       >
                         {role}
                       </button>
                     ))}
                   </div>
                   <label style={labelStyle}>
                     <span style={labelTextStyle}>Admission / Portal ID</span>
                     <input value={admission} onChange={(e) => setAdmission(e.target.value)} type="text" autoComplete="off" placeholder="Admission number" style={fieldStyle} />
                   </label>
                   <label style={labelStyle}>
                     <span style={labelTextStyle}>Password</span>
                     <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="off" style={fieldStyle} />
                   </label>
                   {error ? (
                     <div style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 13 }}>{error}</div>
                   ) : null}
                   <SubmitButton loading={loading} text="Sign In" />
                 </form>
               )}
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: 6 };
const labelTextStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8ea3c4" };
const fieldStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#edf4ff",
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function SubmitButton({ loading, text }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        border: "none",
        borderRadius: 12,
        padding: "12px 16px",
        background: "linear-gradient(135deg, var(--primary-color), var(--secondary-color))",
        color: "#08111f",
        fontWeight: 800,
        fontSize: 15,
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Please wait…" : text}
    </button>
  );
}

SubmitButton.propTypes = {
  loading: PropTypes.bool,
  text: PropTypes.string.isRequired,
};

LoginView.propTypes = {
  onLogin: PropTypes.func.isRequired,
};
