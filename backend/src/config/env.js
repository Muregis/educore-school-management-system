import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load repo-root `.env` (default dotenv behavior for the current working directory)
dotenv.config();

// Also load `backend/.env` when the server is started from the repo root.
// (dotenv does not automatically search subfolders.)
try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const backendDir = path.resolve(__dirname, "../.."); // .../backend
  const backendEnvPath = path.join(backendDir, ".env"); // backend/.env
  if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath, override: false });
  }
} catch {
  // ignore
}

export const env = {
  port:                 Number(process.env.PORT || 4000),
  jwtSecret:            process.env.JWT_SECRET   || "educore_dev_secret_change_me",
  jwtExpiresIn:         process.env.JWT_EXPIRES_IN || "7d",
  supabaseJwtSecret:    process.env.SUPABASE_JWT_SECRET || "",
  corsOrigin:           process.env.CORS_ORIGIN  || "http://localhost:5173",

  // Mpesa Daraja
  mpesaConsumerKey:     process.env.MPESA_CONSUMER_KEY     || "",
  mpesaConsumerSecret:  process.env.MPESA_CONSUMER_SECRET  || "",
  mpesaShortcode:       process.env.MPESA_SHORTCODE        || "174379",
  mpesaPasskey:         process.env.MPESA_PASSKEY          || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
  mpesaBaseUrl:         process.env.MPESA_BASE_URL         || "https://sandbox.safaricom.co.ke",
  mpesaCallbackBaseUrl: process.env.MPESA_CALLBACK_BASE_URL || "https://your-ngrok-url.ngrok.io",

  // Paystack
  paystackSecretKey:    process.env.PAYSTACK_SECRET_KEY    || "",
  paystackPublicKey:    process.env.PAYSTACK_PUBLIC_KEY    || "",
  paystackCallbackUrl:  process.env.PAYSTACK_CALLBACK_URL  || "http://localhost:5173",

  // WhatsApp Business API
  whatsappApiUrl:       process.env.WHATSAPP_API_URL       || "https://graph.facebook.com/v18.0",
  whatsappToken:        process.env.WHATSAPP_TOKEN        || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",

  // Groq
  groqApiKey:           process.env.GROQ_API_KEY || "",

  // Supabase
  supabaseUrl:          process.env.SUPABASE_URL || "",
  supabaseServiceKey:    process.env.SUPABASE_SERVICE_KEY || "",
  supabaseAnonKey:       process.env.SUPABASE_ANON_KEY || "",

  // Email (SMTP)
  smtpHost:     process.env.SMTP_HOST     || "smtp.gmail.com",
  smtpPort:     Number(process.env.SMTP_PORT || 587),
  smtpUser:     process.env.SMTP_USER     || "",
  smtpPass:     process.env.SMTP_PASS     || "",
  smtpFrom:     process.env.SMTP_FROM     || "noreply@greenfield.ac.ke",
  smtpFromName: process.env.SMTP_FROM_NAME|| "Greenfield Academy",
};

// Validate production environment variables
function validateProductionEnv() {
  if (process.env.NODE_ENV === 'production') {
    const required = [
      'JWT_SECRET',
      'SUPABASE_URL', 
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_ANON_KEY'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required production environment variables:');
      missing.forEach(key => console.error(`   - ${key}`));
      console.error('\nPlease set these environment variables before starting in production mode.');
      process.exit(1);
    }
    
    // Warn about optional but recommended variables
    const recommended = [
      'WHATSAPP_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'PAYSTACK_SECRET_KEY',
      'MPESA_CONSUMER_KEY',
      'MPESA_CONSUMER_SECRET'
    ];
    
    const missingRecommended = recommended.filter(key => !process.env[key]);
    if (missingRecommended.length > 0) {
      console.warn('⚠️  Recommended environment variables not set:');
      missingRecommended.forEach(key => console.warn(`   - ${key}`));
      console.warn('Some features may not work properly without these.\n');
    }
  }
}

validateProductionEnv();