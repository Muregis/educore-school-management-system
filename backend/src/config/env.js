import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load repo-root `.env` (default dotenv behavior for the current working directory)
dotenv.config();

// Also load `backend/.env` when the server is started from the repo root.
// (dotenv does not automatically search subfolders.)
const clean = (val) => (val || "").trim().replace(/^['"]|['"]$/g, '').replace(/^false\s+/i, '');

export const env = {
  port:                 Number(process.env.PORT || 10000),
  jwtSecret:            clean(process.env.JWT_SECRET) || "educore_dev_secret_change_me",
  jwtExpiresIn:         process.env.JWT_EXPIRES_IN || "7d",
  // Must match Educore-Ratiba SSO_SHARED_SECRET
  fetTimetableJwtSecret: clean(process.env.SSO_SHARED_SECRET) || clean(process.env.FET_TIMETABLE_JWT_SECRET) || clean(process.env.JWT_SECRET) || "educore_dev_secret_change_me",
  // Absolute URL of Ratiba (no trailing slash)
  fetTimetableBaseUrl:   clean(process.env.FET_TIMETABLE_BASE_URL) || clean(process.env.RATIBA_BASE_URL) || "https://educore-ratiba.onrender.com",
  fetTimetableJwtExpiresIn: process.env.FET_TIMETABLE_JWT_EXPIRES_IN || "5m",
  supabaseJwtSecret:    clean(process.env.SUPABASE_JWT_SECRET),
  corsOrigin:           process.env.CORS_ORIGIN  || "https://educore-school-management-system-pi.vercel.app",
  renderExternalUrl:    clean(process.env.RENDER_EXTERNAL_URL) || clean(process.env.BACKEND_PUBLIC_URL) || clean(process.env.APP_URL),
  groqApiKey:           clean(process.env.GROQ_API_KEY),

  // Mpesa Daraja
  mpesaConsumerKey:     clean(process.env.MPESA_CONSUMER_KEY),
  mpesaConsumerSecret:  clean(process.env.MPESA_CONSUMER_SECRET),
  mpesaShortcode:       process.env.MPESA_SHORTCODE        || "174379",
  mpesaPasskey:         process.env.MPESA_PASSKEY          || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
  mpesaBaseUrl:         process.env.MPESA_BASE_URL         || "https://sandbox.safaricom.co.ke",
  mpesaCallbackBaseUrl: process.env.MPESA_CALLBACK_BASE_URL || "https://your-ngrok-url.ngrok.io",

  // Paystack
  paystackSecretKey:    clean(process.env.PAYSTACK_SECRET_KEY),
  paystackPublicKey:    clean(process.env.PAYSTACK_PUBLIC_KEY),
  paystackCallbackUrl:  process.env.PAYSTACK_CALLBACK_URL  || "http://localhost:5173",

  // WhatsApp Business API
  whatsappApiUrl:       process.env.WHATSAPP_API_URL       || "https://graph.facebook.com/v18.0",
  whatsappToken:        clean(process.env.WHATSAPP_TOKEN),
  whatsappPhoneNumberId: clean(process.env.WHATSAPP_PHONE_NUMBER_ID),

  // Database mode: "cloud" (Supabase) or "local" (PostgreSQL)
  databaseMode:           process.env.DATABASE_MODE || "cloud",

  // Supabase
  supabaseUrl:          clean(process.env.SUPABASE_URL),
  supabaseServiceKey:   clean(process.env.SUPABASE_SERVICE_KEY),
  supabaseAnonKey:      clean(process.env.SUPABASE_ANON_KEY),

  // Shared secret for external cron (daily backups). Header: Authorization: Bearer <CRON_SECRET>
  cronSecret:           clean(process.env.CRON_SECRET),

  // Local PostgreSQL (when DATABASE_MODE=local)
  pgHost:     process.env.PG_HOST     || "localhost",
  pgPort:     Number(process.env.PG_PORT || 5432),
  pgUser:     process.env.PG_USER     || "postgres",
  pgPassword: process.env.PG_PASSWORD || "",
  pgDatabase: process.env.PG_DATABASE || "educore",

  // Cloudinary
  cloudinaryCloudName: clean(process.env.CLOUDINARY_CLOUD_NAME),
  cloudinaryApiKey:    clean(process.env.CLOUDINARY_API_KEY),
  cloudinaryApiSecret: clean(process.env.CLOUDINARY_API_SECRET),

  // SMTP
  smtpHost:     process.env.SMTP_HOST     || "",
  smtpPort:     Number(process.env.SMTP_PORT || 587),
  smtpUser:     process.env.SMTP_USER     || "",
  smtpPass:     process.env.SMTP_PASS     || "",
  smtpFrom:     process.env.SMTP_FROM     || "noreply@greenfield.ac.ke",
  smtpFromName: process.env.SMTP_FROM_NAME|| "Greenfield Academy",

  // Superadmin
  superadminEmail: clean(process.env.SUPERADMIN_EMAIL) || "muregivictor@gmail.com",
  superadminPasswordHash: clean(process.env.SUPERADMIN_PASSWORD_HASH),
};

// Validate production environment variables.
// Fail-closed by default so a misconfigured deploy cannot serve live schools
// with a weak JWT or missing database credentials.
// Emergency only: ALLOW_INSECURE_BOOT=true skips the hard exit (logs loudly).
function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const allowInsecure = String(process.env.ALLOW_INSECURE_BOOT || '').toLowerCase() === 'true';
  const required = [
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_ANON_KEY',
  ];

  const missing = required.filter((key) => !clean(process.env[key]));
  const jwt = clean(process.env.JWT_SECRET);
  const weakJwt =
    !jwt ||
    jwt === 'educore_dev_secret_change_me' ||
    jwt.length < 32;

  const fatal = [];
  if (missing.length) {
    fatal.push(`Missing required env: ${missing.join(', ')}`);
  }
  if (weakJwt) {
    fatal.push(
      'JWT_SECRET must be set to a unique value at least 32 characters (not the development default)'
    );
  }

  if (fatal.length) {
    console.error('[ENV] PRODUCTION CONFIGURATION BLOCKED:');
    fatal.forEach((m) => console.error(`   - ${m}`));
    if (allowInsecure) {
      console.error('[ENV] ALLOW_INSECURE_BOOT=true — starting anyway. REMOVE this flag after fixing secrets.');
    } else {
      console.error('[ENV] Refusing to start. Fix secrets, or set ALLOW_INSECURE_BOOT=true only for emergency recovery.');
      process.exit(1);
    }
  }

  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === 'http://localhost:5173') {
    console.error('SECURITY WARNING: CORS_ORIGIN should be explicitly set to your production frontend URL');
    console.error('   Current value:', process.env.CORS_ORIGIN || 'not set');
  }

  const recommended = [
    'CRON_SECRET',
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'PAYSTACK_SECRET_KEY',
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'SSO_SHARED_SECRET',
  ];
  const missingRecommended = recommended.filter((key) => !clean(process.env[key]));
  if (missingRecommended.length) {
    console.warn('[ENV] Recommended (features may be limited):', missingRecommended.join(', '));
  }
}

validateProductionEnv();
