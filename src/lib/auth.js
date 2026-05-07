const SESSION_KEY = "educore.session";
const LEGACY_AUTH_KEY = "educore.auth";
const LEGACY_TOKEN_KEY = "token";
const DEFAULT_PROD_API_BASE = "https://educore-school-management-system.onrender.com/api";
const DEFAULT_LOCAL_API_BASE = "http://localhost:10000/api";

function getApiBase() {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window === "undefined") return DEFAULT_PROD_API_BASE;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? DEFAULT_LOCAL_API_BASE
    : DEFAULT_PROD_API_BASE;
}

export function saveSession(data) {
  const session = {
    token: data.token,
    sessionId: data.sessionId,
    user: data.user || data,
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(LEGACY_AUTH_KEY, JSON.stringify({ ...session.user, token: session.token, sessionId: session.sessionId }));
  if (session.token) sessionStorage.setItem(LEGACY_TOKEN_KEY, session.token);
}

export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      clearSession();
      return null;
    }
  }

  const legacyRaw = sessionStorage.getItem(LEGACY_AUTH_KEY);
  if (!legacyRaw) return null;

  try {
    const legacy = JSON.parse(legacyRaw);
    if (!legacy?.token) return null;
    return {
      token: legacy.token,
      sessionId: legacy.sessionId || null,
      user: legacy,
    };
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getAuthHeaders(token = null) {
  const session = getSession();
  const resolvedToken = token || session?.token || null;
  const headers = {};

  if (resolvedToken) headers.Authorization = `Bearer ${resolvedToken}`;
  if (session?.sessionId) headers["x-session-id"] = session.sessionId;

  const auth = session?.user || {};
  const role = String(auth.role || "").toLowerCase();
  if ((role === "director" || role === "superadmin") && auth.schoolId) {
    headers["X-School-Id"] = auth.schoolId;
  }

  return headers;
}

export function logout() {
  const session = getSession();
  if (session?.token && session?.sessionId) {
    fetch(`${getApiBase()}/auth/logout`, {
      method: "POST",
      headers: getAuthHeaders(session.token),
    }).catch(() => {});
  }

  clearSession();
  window.location.href = "/login";
}
