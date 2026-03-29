const isDebugEnabled = (process.env.TENANT_DEBUG || "true").toLowerCase() !== "false";

function maskSensitive(payload = {}) {
  if (!payload || typeof payload !== "object") return payload;
  const clone = { ...payload };
  for (const key of Object.keys(clone)) {
    if (/password|secret|token|hash|key/i.test(key)) {
      clone[key] = "[REDACTED]";
    }
  }
  return clone;
}

export function logTenantContext(label, req, extra = {}) {
  if (!isDebugEnabled) return;
  const userId = req?.user?.user_id ?? req?.user?.userId ?? null;
  const schoolId = req?.user?.school_id ?? req?.user?.schoolId ?? null;
  console.info(
    `[tenant_debug] ${label}`,
    JSON.stringify(maskSensitive({ userId, schoolId, ...extra }))
  );
}

export function logTenantQuery(label, details = {}) {
  if (!isDebugEnabled) return;
  console.info(
    `[tenant_query] ${label}`,
    JSON.stringify(maskSensitive(details))
  );
}
