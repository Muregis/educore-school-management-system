import { useEffect, useMemo, useState } from "react";
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
    desc: "Grades, report cards, and performance updates in one place.",
    icon: "AR",
  },
  {
    title: "Fee Payments",
    desc: "Track balances and complete payments securely online.",
    icon: "FP",
  },
  {
    title: "Attendance Tracking",
    desc: "See attendance records and daily school activity clearly.",
    icon: "AT",
  },
  {
    title: "School Communication",
    desc: "Receive announcements and updates from staff in real time.",
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
  const [schoolId, setSchoolId] = useState(() => getInitialSchoolId());
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [tenantReady, setTenantReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [manualSchool, setManualSchool] = useState(() => Boolean(getInitialSchoolId()));

  const activeIdentifier = mode === "staff" ? email : admission;
  const schoolOptions = branding.schoolOptions || [];

  useEffect(() => {
    let cancelled = false;

    async function primeBranding() {
      try {
        const hostname = window.location.hostname;
        const res = await apiFetch(buildResolveSchoolPath({
          hostname,
          selectedSchoolId: schoolId,
          role: mode === "portal" ? portalRole : "staff",
        }));
        if (!cancelled) {
          setBranding({ ...DEFAULT_BRANDING, ...res, schoolOptions: res.schoolOptions || [] });
        }
      } catch (_err) {
        if (!cancelled) {
          setBranding(DEFAULT_BRANDING);
        }
      } finally {
        if (!cancelled) setTenantReady(true);
      }
    }

    primeBranding();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!tenantReady) return undefined;
    if (!activeIdentifier && !schoolId) {
      setBranding(prev => ({ ...DEFAULT_BRANDING, ...prev, schoolOptions: [] }));
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const res = await apiFetch(buildResolveSchoolPath({
          hostname: window.location.hostname,
          loginId: activeIdentifier,
          selectedSchoolId: schoolId,
          role: mode === "portal" ? portalRole : "staff",
        }));
        setBranding({ ...DEFAULT_BRANDING, ...res, schoolOptions: res.schoolOptions || [] });
      } catch (_err) {
        setBranding(DEFAULT_BRANDING);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [activeIdentifier, schoolId, portalRole, mode, tenantReady]);

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
      const numericSchoolId = schoolId ? Number(schoolId) : null;
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password, schoolId: numericSchoolId },
      });
      onLogin({
        id: data.user.userId,
        name: data.user.name,
        email: data.user.email ?? email,
        role: data.user.role,
        schoolId: data.user.schoolId,
        token: data.token,
        studentId: null,
      });
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitPortal(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const numericSchoolId = schoolId ? Number(schoolId) : null;
      const data = await apiFetch("/auth/portal-login", {
        method: "POST",
        body: {
          admissionNumber: admission.trim(),
          password,
          role: portalRole,
          schoolId: numericSchoolId,
        },
      });
      onLogin({
        id: data.user.userId,
        name: data.user.name,
        role: data.user.role,
        schoolId: data.user.schoolId,
        token: data.token,
        studentId: data.user.studentId,
        admission: admission.trim(),
        feeBlocked: data.feeBlocked ?? false,
      });`n      setAdmission("");"+"n      setPassword("");
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
              {branding.established_year ? <span>� Since {branding.established_year}</span> : null}
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
                <div key={feature.title} style={{ padding: 18, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--primary-color), var(--secondary-color))", color: "#08111f", fontSize: 12, fontWeight: 800, marginBottom: 12 }}>{feature.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{feature.title}</div>
                  <div style={{ color: "#88a0bf", fontSize: 13, lineHeight: 1.6 }}>{feature.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ color: "#6d819d", fontSize: 12 }}>
            Powered by <span style={{ color: "var(--primary-color)" }}>EduCore</span> � Tenant-aware secure login
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

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {manualSchool ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ color: "#95a9c6", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>School ID</span>
                  <input value={schoolId} onChange={(e) => setSchoolId(e.target.value)} placeholder="e.g. 101" style={fieldStyle} />
                </label>
              ) : null}

              {schoolOptions.length > 1 ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ color: "#95a9c6", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Choose school</span>
                  <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={fieldStyle}>
                    <option value="">Select your school</option>
                    {schoolOptions.map(option => (
                      <option key={option.school_id} value={option.school_id}>{option.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {mode === "staff" ? (
                <form onSubmit={submitStaff} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Email address</span>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@school.ac.ke" style={fieldStyle} />
                  </label>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Password</span>
                    <div style={{ position: "relative" }}>
                      <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter password" style={{ ...fieldStyle, paddingRight: 52 }} />
                      <button type="button" onClick={() => setShowPassword(prev => !prev)} style={toggleButtonStyle}>{showPassword ? "Hide" : "Show"}</button>
                    </div>
                  </label>
                  <SubmitButton loading={loading} text="Sign In" />
                </form>
              ) : (
                <form onSubmit={submitPortal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { id: "parent", label: "Parent" },
                      { id: "student", label: "Student" },
                    ].map(option => {
                      const active = portalRole === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPortalRole(option.id)}
                          style={{
                            borderRadius: 12,
                            padding: "11px 12px",
                            border: active ? "1px solid var(--primary-color)" : "1px solid rgba(255,255,255,0.1)",
                            background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                            color: active ? "var(--primary-color)" : "#d7e4fb",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Admission number</span>
                    <input value={admission} onChange={(e) => setAdmission(e.target.value)} autoComplete="username" placeholder="e.g. ADM-2020-001" style={fieldStyle} />
                  </label>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Password</span>
                    <div style={{ position: "relative" }}>
                      <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter password" style={{ ...fieldStyle, paddingRight: 52 }} />
                      <button type="button" onClick={() => setShowPassword(prev => !prev)} style={toggleButtonStyle}>{showPassword ? "Hide" : "Show"}</button>
                    </div>
                  </label>
                  <SubmitButton loading={loading} text="Access Portal" />
                </form>
              )}

              {error ? (
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.24)", color: "#ffb6c1", fontSize: 13 }}>
                  {error}
                </div>
              ) : null}

              <button type="button" onClick={() => setManualSchool(prev => !prev)} style={{ alignSelf: "center", border: "none", background: "transparent", color: "var(--secondary-color)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                {manualSchool ? "Hide manual school selector" : "Choose school manually"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SubmitButton({ loading, text }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        marginTop: 6,
        border: "none",
        borderRadius: 14,
        padding: "14px 18px",
        background: "linear-gradient(135deg, var(--primary-color), var(--secondary-color))",
        color: "#08111f",
        fontSize: 15,
        fontWeight: 800,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Signing in..." : text}
    </button>
  );
}

SubmitButton.propTypes = {
  loading: PropTypes.bool.isRequired,
  text: PropTypes.string.isRequired,
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelTextStyle = {
  color: "#95a9c6",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#edf4ff",
  padding: "13px 14px",
  outline: "none",
  fontSize: 14,
};

const toggleButtonStyle = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: "#9db0cb",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

LoginView.propTypes = {
  onLogin: PropTypes.func.isRequired,
};



