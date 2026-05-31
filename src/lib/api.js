// simple wrapper for calling backend API with optional auth token
import { clearSession, getAuthHeaders, getSession } from "./auth.js";

// Production Render backend. Keep this fallback aligned with Vercel so a
// missing VITE_API_URL does not strand the app on an old service URL.
const DEFAULT_PROD_API_BASE = "https://educore-school-management-system.onrender.com/api";
const DEFAULT_LOCAL_API_BASE = "http://localhost:10000/api";

function getDefaultApiBase() {
  if (typeof window === "undefined") return DEFAULT_PROD_API_BASE;

  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  return isLocalHost ? DEFAULT_LOCAL_API_BASE : DEFAULT_PROD_API_BASE;
}

// OLD: export const API_BASE = "http://localhost:4001/api";
export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  getDefaultApiBase();

export async function apiFetch(
  path,
  { method = "GET", body = null, token = null, timeoutMs = 45000, signal = null, retries = 1 } = {}
) {
  const headers = {};
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }
  Object.assign(headers, getAuthHeaders(token));

  let timedOut = false;
  
  // Retry loop for timeout/network errors
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    if (signal) {
      if (signal.aborted) { console.log('[apiFetch] Signal already aborted, throwing EABORT'); const e = new Error('Request cancelled.'); e.code = 'EABORT'; throw e; }
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      console.log('[apiFetch] Timeout reached, aborting controller');
      controller.abort();
    }, timeoutMs);
    
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : null,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        let err;
        try { err = JSON.parse(text); } catch { err = { message: text }; }
        if (res.status === 401 && getSession()) {
          clearSession();
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login";
          }
        }
        const e = new Error(err.message || res.statusText);
        e.status = res.status;
        throw e;
      }

      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err?.name === "AbortError") {
        if (timedOut && attempt < retries) {
          // Retry on timeout
          console.warn(`[apiFetch] Timeout on attempt ${attempt + 1}, retrying...`);
          await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
          timedOut = false;
          continue;
        }
        const e = timedOut
          ? new Error("Request timed out. Please try again.")
          : new Error("Request cancelled.");
        e.code = timedOut ? "ETIMEOUT" : "EABORT";
        throw e;
      }
      
      // Retry on network errors too
      if (err instanceof TypeError && attempt < retries) {
        console.warn(`[apiFetch] Network error on attempt ${attempt + 1}, retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      if (err instanceof TypeError) {
        const e = new Error("Network error. Backend may be down or unreachable.");
        e.code = "ENETWORK";
        throw e;
      }
      throw err;
    }
  }
}



