#!/usr/bin/env node
import fs from "fs";

// --- env.js fail-closed production validation ---
{
  const path = "backend/src/config/env.js";
  let t = fs.readFileSync(path, "utf8");
  const start = t.indexOf("// Validate production environment variables");
  const end = t.indexOf("validateProductionEnv();", start);
  if (start === -1 || end === -1) {
    console.error("env validate block markers not found");
    process.exit(1);
  }
  const replacement = `// Validate production environment variables.\n// Fail-closed by default so a misconfigured deploy cannot serve live schools\n// with a weak JWT or missing database credentials.\n// Emergency only: ALLOW_INSECURE_BOOT=true skips the hard exit (logs loudly).\nfunction validateProductionEnv() {\n  if (process.env.NODE_ENV !== 'production') return;\n\n  const allowInsecure = String(process.env.ALLOW_INSECURE_BOOT || '').toLowerCase() === 'true';\n  const required = [\n    'JWT_SECRET',\n    'SUPABASE_URL',\n    'SUPABASE_SERVICE_KEY',\n    'SUPABASE_ANON_KEY',\n  ];\n\n  const missing = required.filter((key) => !clean(process.env[key]));\n  const jwt = clean(process.env.JWT_SECRET);\n  const weakJwt =\n    !jwt ||\n    jwt === 'educore_dev_secret_change_me' ||\n    jwt.length < 32;\n\n  const fatal = [];\n  if (missing.length) {\n    fatal.push(\`Missing required env: \${missing.join(', ')}\`);\n  }\n  if (weakJwt) {\n    fatal.push(\n      'JWT_SECRET must be set to a unique value at least 32 characters (not the development default)'\n    );\n  }\n\n  if (fatal.length) {\n    console.error('[ENV] PRODUCTION CONFIGURATION BLOCKED:');\n    fatal.forEach((m) => console.error(\`   - \${m}\`));\n    if (allowInsecure) {\n      console.error('[ENV] ALLOW_INSECURE_BOOT=true — starting anyway. REMOVE this flag after fixing secrets.');\n    } else {\n      console.error('[ENV] Refusing to start. Fix secrets, or set ALLOW_INSECURE_BOOT=true only for emergency recovery.');\n      process.exit(1);\n    }\n  }\n\n  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === 'http://localhost:5173') {\n    console.error('SECURITY WARNING: CORS_ORIGIN should be explicitly set to your production frontend URL');\n    console.error('   Current value:', process.env.CORS_ORIGIN || 'not set');\n  }\n\n  const recommended = [\n    'CRON_SECRET',\n    'WHATSAPP_TOKEN',\n    'WHATSAPP_PHONE_NUMBER_ID',\n    'PAYSTACK_SECRET_KEY',\n    'MPESA_CONSUMER_KEY',\n    'MPESA_CONSUMER_SECRET',\n    'SSO_SHARED_SECRET',\n  ];\n  const missingRecommended = recommended.filter((key) => !clean(process.env[key]));\n  if (missingRecommended.length) {\n    console.warn('[ENV] Recommended (features may be limited):', missingRecommended.join(', '));\n  }\n}\n\n`;
  t = t.slice(0, start) + replacement + t.slice(end);
  fs.writeFileSync(path, t);
  console.log("env.js fail-closed");
}

// --- roles.js gate DEBUG logs ---
{
  const path = "backend/src/middleware/roles.js";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("AUTH_DEBUG_ENABLED")) {
    const lines = t.split("\n");
    let last = 0;
    lines.forEach((l, i) => {
      if (l.startsWith("import ")) last = i;
    });
    lines.splice(
      last + 1,
      0,
      'const AUTH_DEBUG_ENABLED = (process.env.AUTH_DEBUG || process.env.TENANT_DEBUG || "false").toLowerCase() === "true";'
    );
    t = lines.join("\n");
  }
  t = t.replaceAll("console.log(`[DEBUG]", "AUTH_DEBUG_ENABLED && console.log(`[DEBUG]");
  while (t.includes("AUTH_DEBUG_ENABLED && AUTH_DEBUG_ENABLED &&")) {
    t = t.replaceAll("AUTH_DEBUG_ENABLED && AUTH_DEBUG_ENABLED &&", "AUTH_DEBUG_ENABLED &&");
  }
  fs.writeFileSync(path, t);
  console.log("roles.js debug gated");
}

// --- supabase-jwt quiet ---
{
  const path = "backend/src/helpers/supabase-jwt.js";
  let t = fs.readFileSync(path, "utf8");
  t = t.replace('  console.log("🔐 Generating Supabase JWT for school_id:", school_id);\n', "");
  t = t.replace('  console.log("✅ Supabase JWT Secret found, signing token...");\n', "");
  t = t.replace('  console.log("✅ Supabase JWT generated successfully");\n', "");
  fs.writeFileSync(path, t);
  console.log("supabase-jwt quiet");
}

console.log("apply-saas-solid-8 done");
