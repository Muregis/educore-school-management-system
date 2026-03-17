// simple wrapper for calling backend API with optional auth token
export const API_BASE = "http://localhost:4000/api";

export async function apiFetch(
  path,
  { method = "GET", body = null, token = null, timeoutMs = 20000, signal = null } = {}
) {
  const headers = {};
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }
  // OLD: if (token) {
  // OLD:   headers["Authorization"] = `Bearer ${token}`;
  // OLD: }
  const resolvedToken = token || localStorage.getItem("token") || null;
  if (resolvedToken) {
    headers["Authorization"] = `Bearer ${resolvedToken}`;
  }

  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      let err;
      try { err = JSON.parse(text); } catch { err = { message: text }; }
      const e = new Error(err.message || res.statusText);
      e.status = res.status;
      throw e;
    }

    return res.json();
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = timedOut
        ? new Error("Request timed out. Please try again.")
        : new Error("Request cancelled.");
      e.code = timedOut ? "ETIMEOUT" : "EABORT";
      throw e;
    }
    if (err instanceof TypeError) {
      const e = new Error("Network error. Backend may be down or unreachable.");
      e.code = "ENETWORK";
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
