import { z } from 'zod';
import { env } from './env.js';

/**
 * Central Configuration
 * Extends existing env.js with enterprise-grade configuration validation
 * Preserves all existing environment variables while adding structure
 */

/**
 * Configuration schema validation
 * Ensures all required configuration is present and valid
 */
const configSchema = z.object({
  // Server
  port: z.number().int().positive().max(65535),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // JWT
  jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  jwtExpiresIn: z.string(),
  
  // CORS
  corsOrigin: z.string().min(1),
  
  // Supabase
  supabaseUrl: z.string().url(),
  supabaseServiceKey: z.string().min(1),
  supabaseAnonKey: z.string().min(1),
  
  // Cloudinary
  cloudinaryCloudName: z.string().min(1).optional(),
  cloudinaryApiKey: z.string().min(1).optional(),
  cloudinaryApiSecret: z.string().min(1).optional(),
  
  // SMTP
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email(),
  smtpFromName: z.string().min(1),
  
  // Payment Gateways
  paystackSecretKey: z.string().optional(),
  paystackPublicKey: z.string().optional(),
  mpesaConsumerKey: z.string().optional(),
  mpesaConsumerSecret: z.string().optional(),
  
  // WhatsApp
  whatsappToken: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional()
});

/**
 * Validate and export configuration
 */
const validatedConfig = configSchema.parse({
  port: env.port,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: env.jwtSecret,
  jwtExpiresIn: env.jwtExpiresIn,
  corsOrigin: env.corsOrigin,
  supabaseUrl: env.supabaseUrl,
  supabaseServiceKey: env.supabaseServiceKey,
  supabaseAnonKey: env.supabaseAnonKey,
  cloudinaryCloudName: env.cloudinaryCloudName,
  cloudinaryApiKey: env.cloudinaryApiKey,
  cloudinaryApiSecret: env.cloudinaryApiSecret,
  smtpHost: env.smtpHost,
  smtpPort: env.smtpPort,
  smtpUser: env.smtpUser,
  smtpPass: env.smtpPass,
  smtpFrom: env.smtpFrom,
  smtpFromName: env.smtpFromName,
  paystackSecretKey: env.paystackSecretKey,
  paystackPublicKey: env.paystackPublicKey,
  mpesaConsumerKey: env.mpesaConsumerKey,
  mpesaConsumerSecret: env.mpesaConsumerSecret,
  whatsappToken: env.whatsappToken,
  whatsappPhoneNumberId: env.whatsappPhoneNumberId
});

/**
 * Export validated configuration
 * Extends existing env object with validation
 */
export const config = {
  ...env,
  ...validatedConfig,
  
  // Enterprise-specific configuration
  enterprise: {
    enableIdempotency: process.env.ENABLE_IDEMPOTENCY === 'true',
    enableRequestTracing: process.env.ENABLE_REQUEST_TRACING !== 'false',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    maxRequestSize: '10mb',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'text/csv'],
    
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      standardHeaders: true,
      legacyHeaders: false
    },
    
    // Pagination defaults
    pagination: {
      defaultLimit: 20,
      maxLimit: 100
    },
    
    // Cache configuration
    cache: {
      enabled: process.env.ENABLE_CACHE === 'true',
      ttl: 300, // 5 minutes default
      checkperiod: 600 // 10 minutes
    }
  },
  
  // Feature flags
  features: {
    academicYearEngine: process.env.FEATURE_ACADEMIC_YEAR_ENGINE === 'true',
    advancedFinance: process.env.FEATURE_ADVANCED_FINANCE === 'true',
    libraryEnterprise: process.env.FEATURE_LIBRARY_ENTERPRISE === 'true',
    hrPayroll: process.env.FEATURE_HR_PAYROLL === 'true',
    reportingEngine: process.env.FEATURE_REPORTING_ENGINE === 'true'
  }
};

export default config;
