#!/usr/bin/env node
/** Apply TM release-blocker backend patches. Idempotent. Run from repo root. */
import fs from "fs";
import path from "path";

function patch(rel, transforms) {
  const p = path.join(process.cwd(), rel);
  let t = fs.readFileSync(p, "utf8");
  const before = t;
  for (const [name, fn] of transforms) {
    const n = fn(t);
    if (n === t) console.warn("no-op:", name);
    else console.log("ok:", name);
    t = n;
  }
  if (t !== before) {
    fs.writeFileSync(p, t);
    console.log("wrote", rel);
  }
}

patch("backend/src/app.js", [
  ["isPublicApiPath", (t) => {
    if (t.includes("function isPublicApiPath")) return t;
    const old = `app.use("/api", (req, res, next) => {
  // When middleware is mounted at /api, req.path is relative (e.g. /auth/login, /onboarding/...).
  const p = String(req.path || "");
  const full = String(req.originalUrl || "");
  const exemptPrefixes = [
    "/health", "/auth", "/onboarding", "/public",
    "/teacherassignments", "/teacher-assignments",
    "/api/health", "/api/auth", "/api/onboarding", "/api/public",
  ];
  const isExempt = exemptPrefixes.some((prefix) => p.startsWith(prefix) || full.startsWith(prefix));
  if (isExempt) return next();
  return authRequired(req, res, next);
});

app.use("/api", validateSession);
app.use("/api", tenantContext);
app.use("/api", tenantSecurityCheck);`;
    const neu = `function isPublicApiPath(req) {
  const p = String(req.path || "");
  const full = String(req.originalUrl || "").split("?")[0];
  const exemptPrefixes = [
    "/health", "/auth", "/onboarding", "/public",
    "/teacherassignments", "/teacher-assignments",
    "/api/health", "/api/auth", "/api/onboarding", "/api/public",
  ];
  return exemptPrefixes.some((prefix) => p.startsWith(prefix) || full.startsWith(prefix));
}

app.use("/api", (req, res, next) => {
  if (isPublicApiPath(req)) return next();
  return authRequired(req, res, next);
});

app.use("/api", (req, res, next) => {
  if (isPublicApiPath(req)) return next();
  return validateSession(req, res, next);
});
app.use("/api", (req, res, next) => {
  if (isPublicApiPath(req)) return next();
  return tenantContext(req, res, next);
});
app.use("/api", (req, res, next) => {
  if (isPublicApiPath(req)) return next();
  return tenantSecurityCheck(req, res, next);
});`;
    if (!t.includes("exemptPrefixes")) throw new Error("app.js pattern not found");
    return t.replace(old, neu);
  }],
]);

patch("backend/src/routes/auth.routes.js", [
  ["GET login 405", (t) => {
    if (t.includes('router.get("/login"')) return t;
    const needle = "// ─── POST /api/auth/login";
    const insert = `// ─── GET /api/auth/login (not supported — document contract) ───────────\nrouter.get("/login", (_req, res) => {\n  res.status(405).json({\n    error: "Method not allowed. Use POST /api/auth/login with email and password.",\n    code: "AUTH_METHOD_NOT_ALLOWED",\n  });\n});\n\n`;
    if (!t.includes(needle)) throw new Error("auth needle missing");
    return t.replace(needle, insert + needle);
  }],
]);

patch("backend/src/routes/students.routes.js", [
  ["import fee util", (t) => {
    if (t.includes("buildStudentFeeUpdateData")) return t;
    const lines = t.split("\n");
    let last = 0;
    lines.forEach((l, i) => { if (l.startsWith("import ")) last = i; });
    lines.splice(last + 1, 0, 'import { buildStudentFeeUpdateData } from "../utils/studentFeeUpdate.js";');
    return lines.join("\n");
  }],
  ["use fee util", (t) => {
    if (t.includes("buildStudentFeeUpdateData(req.body)")) return t;
    return t.replace(
      /const updateData = \{ updated_at: new Date\(\)\.toISOString\(\) \};\s*(?:if \([^\)]+\) [^\n]+\n\s*)+/,
      (m) => {
        if (!m.includes("lunch_enabled") && !m.includes("opening_balance")) return m;
        return "const updateData = buildStudentFeeUpdateData(req.body);\n\n    ";
      }
    );
  }],
]);

console.log("Backend TM blockers applied.");
