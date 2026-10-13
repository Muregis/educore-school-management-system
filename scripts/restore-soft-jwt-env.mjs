#!/usr/bin/env node
import fs from "fs";

const path = "backend/src/config/env.js";
let t = fs.readFileSync(path, "utf8");

const soft = `// Validate production environment variables\nfunction validateProductionEnv() {\n  if (process.env.NODE_ENV === 'production') {\n    const required = [\n      'JWT_SECRET',\n      'SUPABASE_URL', \n      'SUPABASE_SERVICE_KEY',\n      'SUPABASE_ANON_KEY'\n    ];\n    \n    const missing = required.filter(key => !process.env[key]);\n    \n    if (missing.length > 0) {\n      console.error('Missing required production environment variables:');\n      missing.forEach(key => console.error(\`   - \${key}\`));\n      console.error('\\nPlease set these environment variables before starting in production mode.');\n      console.error('[ENV] Continuing startup despite missing variables - errors will occur...');\n    }\n    \n    if (process.env.JWT_SECRET === 'educore_dev_secret_change_me') {\n      console.error('SECURITY WARNING: JWT_SECRET is set to default development value in production!');\n      console.error('   Please set a strong, unique JWT_SECRET for production.');\n    }\n    \n    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === 'http://localhost:5173') {\n      console.error('SECURITY WARNING: CORS_ORIGIN should be explicitly set to your production frontend URL');\n      console.error('   Current value:', process.env.CORS_ORIGIN || 'not set');\n      console.error('   Example: https://your-school-app.vercel.app');\n    }\n    \n    const recommended = [\n      'WHATSAPP_TOKEN',\n      'WHATSAPP_PHONE_NUMBER_ID',\n      'PAYSTACK_SECRET_KEY',\n      'MPESA_CONSUMER_KEY',\n      'MPESA_CONSUMER_SECRET',\n      'SSO_SHARED_SECRET',\n      'CRON_SECRET'\n    ];\n    \n    const missingRecommended = recommended.filter(key => !process.env[key]);\n    if (missingRecommended.length > 0) {\n      console.warn('Recommended environment variables not set:');\n      missingRecommended.forEach(key => console.warn(\`   - \${key}\`));\n      console.warn('Some features may not work properly without these.\\n');\n    }\n  }\n}\n\nvalidateProductionEnv();\n`;

// Replace from either old soft or fail-closed marker through validateProductionEnv(); call
const markers = [
  "// Validate production environment variables.\n// Fail-closed",
  "// Validate production environment variables\nfunction validateProductionEnv",
];
let start = -1;
for (const m of markers) {
  const i = t.indexOf(m.startsWith("// Validate production environment variables.\n// Fail-closed")
    ? "// Validate production environment variables."
    : "// Validate production environment variables");
  if (i !== -1) {
    start = i;
    break;
  }
}
if (start === -1) {
  // try fail-closed only
  start = t.indexOf("function validateProductionEnv");
  if (start !== -1) {
    // include preceding comments
    const comment = t.lastIndexOf("//", start);
    if (comment !== -1 && start - comment < 400) start = comment;
  }
}
if (start === -1) {
  console.error("validateProductionEnv not found");
  process.exit(1);
}
const end = t.indexOf("validateProductionEnv();", start);
if (end === -1) {
  console.error("validateProductionEnv(); call not found");
  process.exit(1);
}
const endAt = end + "validateProductionEnv();".length;
t = t.slice(0, start) + soft + t.slice(endAt);
fs.writeFileSync(path, t);

if (t.includes("process.exit(1)")) {
  console.error("process.exit still present");
  process.exit(1);
}
if (!t.includes("Continuing startup despite missing variables")) {
  console.error("soft message missing");
  process.exit(1);
}
console.log("JWT/env validation restored to soft-warn (no hard exit)");
