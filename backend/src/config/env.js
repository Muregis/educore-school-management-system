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
  supabaseJwtSecret:    clean(process.env.SUPABASE_JWT_SECRET),
  corsOrigin:           process.env.CORS_ORIGIN  || "https://educore-school-management-system-pi.vercel.app",
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

  // Supabase
  supabaseUrl:          clean(process.env.SUPABASE_URL),
  supabaseServiceKey:   clean(process.env.SUPABASE_SERVICE_KEY),
  supabaseAnonKey:      clean(process.env.SUPABASE_ANON_KEY),

  // Email (SMTP)
  smtpHost:     process.env.SMTP_HOST     || "smtp.gmail.com",
  smtpPort:     Number(process.env.SMTP_PORT || 587),
  smtpUser:     process.env.SMTP_USER     || "",
  smtpPass:     process.env.SMTP_PASS     || "",
  smtpFrom:     process.env.SMTP_FROM     || "noreply@greenfield.ac.ke",
  smtpFromName: process.env.SMTP_FROM_NAME|| "Greenfield Academy",

  // Superadmin
  superadminEmail: clean(process.env.SUPERADMIN_EMAIL) || "muregivictor@gmail.com",
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
      console.error('[ENV] Continuing startup despite missing variables - errors will occur...');
    }
    
    // SECURITY FIX M5: Warn about insecure JWT_SECRET fallback in production
    if (process.env.JWT_SECRET === 'educore_dev_secret_change_me') {
      console.error('⚠️ SECURITY WARNING: JWT_SECRET is set to default development value in production!');
      console.error('   Please set a strong, unique JWT_SECRET for production.');
    }
    
    // SECURITY FIX M4: Warn about CORS origin in production
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === 'http://localhost:5173') {
      console.error('⚠️ SECURITY WARNING: CORS_ORIGIN should be explicitly set to your production frontend URL');
      console.error('   Current value:', process.env.CORS_ORIGIN || 'not set');
      console.error('   Example: https://your-school-app.vercel.app');
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