const SESSION_KEY = "educore.session";
const LEGACY_AUTH_KEY = "educore.auth";
const LEGACY_TOKEN_KEY = "token";
const ACTIVE_SCHOOL_KEY = "educore.activeSchool";
// Production Render backend. Keep this fallback aligned with Vercel so a
// missing VITE_API_URL does not strand auth/logout on an old service URL.
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
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(LEGACY_AUTH_KEY, JSON.stringify({ ...session.user, token: session.token, sessionId: session.sessionId }));
  if (session.token) localStorage.setItem(LEGACY_TOKEN_KEY, session.token);
}

export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      clearSession();
      return null;
    }
  }

  const legacyRaw = sessionStorage.getItem(LEGACY_AUTH_KEY) || localStorage.getItem(LEGACY_AUTH_KEY);
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
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_AUTH_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getAuthHeaders(token = null) {
  const session = getSession();
  const resolvedToken = token || session?.token || null;
  const headers = {};

  if (resolvedToken) headers.Authorization = `Bearer ${resolvedToken}`;
  if (session?.sessionId) headers["x-session-id"] = session.sessionId;

  const auth = session?.user || {};
  const role = String(auth.role || "").toLowerCase();
  
  let activeSchoolId;
  try {
    activeSchoolId = localStorage.getItem(ACTIVE_SCHOOL_KEY);
  } catch (e) {
    activeSchoolId = null;
  }
  
  if ((role === "director" || role === "superadmin")) {
    const schoolId = activeSchoolId || auth.schoolId;
    if (schoolId) {
      headers["x-school-id"] = schoolId;
      headers["X-School-Id"] = schoolId;
      headers["x-active-school-id"] = schoolId;
      headers["x-active-school"] = schoolId;
    }
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
  
  // Aggressive credential clearing on logout
  if (typeof window !== "undefined") {
    // Clear additional localStorage items that might contain credentials
    localStorage.removeItem('educore.auth');
    localStorage.removeItem('educore.remember');
    localStorage.removeItem('educore.activeSchool');
    localStorage.removeItem('educore.session');
    localStorage.removeItem('educore.legacy.auth');
    localStorage.removeItem('token');
    
    // Clear all sessionStorage
    sessionStorage.clear();
    
    // Clear any form data that browser might have stored
    const forms = document.querySelectorAll('form');
    forms.forEach(form => form.reset());
    
    // Clear autocomplete values aggressively
    const inputs = document.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]');
    inputs.forEach(input => {
      input.value = '';
      input.autocomplete = 'off';
    });
    
    // Try to clear browser's password manager suggestions
    try {
      if (navigator.credentials && navigator.credentials.preventSilentAccess) {
        navigator.credentials.preventSilentAccess();
      }
    } catch (e) {
      // Ignore if credentials API is not available
    }
  }
  
  window.location.href = "/login";
}
