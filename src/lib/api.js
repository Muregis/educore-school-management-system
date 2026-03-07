// simple wrapper for calling backend API with optional auth token
export const API_BASE = "http://localhost:4000/api";

export async function apiFetch(path, { method = "GET", body = null, token = null } = {}) {
  const headers = {};
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body != null ? JSON.stringify(body) : null });
  if (!res.ok) {
    const text = await res.text();
    let err;
    try { err = JSON.parse(text); } catch { err = { message: text }; }
    const e = new Error(err.message || res.statusText);
    e.status = res.status;
    throw e;
  }
  return res.json();
}