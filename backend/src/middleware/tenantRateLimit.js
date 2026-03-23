import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

// Tenant-aware rate limiting to prevent abuse and ensure fair resource usage
export function createTenantRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 1000, // requests per window per tenant
    message = "Too many requests from your school, please try again later.",
    standardHeaders = true,
    legacyHeaders = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders,
    legacyHeaders,
    // Use tenant ID as key for rate limiting
    keyGenerator: (req) => {
      // Fallback to IP if no user context (health checks, etc.)
      if (!req.user?.school_id) {
        return `anonymous_${req.ip}`;
      }
      return `tenant_${req.user.school_id}_${req.ip}`;
    },
    // Enhanced logging for rate limit violations
    handler: (req, res) => {
      const tenantId = req.user?.school_id || 'anonymous';
      const role = req.user?.role || 'unknown';
      
      console.warn(`[RATE_LIMIT] Tenant ${tenantId} (${role}) exceeded rate limit`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      res.status(429).json({
        error: message,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil(windowMs / 1000),
        tenantId
      });
    },
    // Skip rate limiting for health checks and critical callbacks
    skip: (req) => {
      const skipPaths = [
        '/api/health',
        '/api/health/live',
        '/api/health/ready',
        '/api/mpesa/callback',
        '/api/paystack/webhook',
        '/api/paystack/callback'
      ];
      
      return skipPaths.some(path => req.path.startsWith(path));
    }
  });
}

// Stricter rate limits for sensitive operations
export const authRateLimit = createTenantRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 auth attempts per 15 minutes per tenant
  message: "Too many authentication attempts, please try again later."
});

export const paymentRateLimit = createTenantRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 payment attempts per minute per tenant
  message: "Too many payment attempts, please try again later."
});

export const webhookRateLimit = createTenantRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhook callbacks per minute per tenant
  message: "Webhook rate limit exceeded."
});

// Default API rate limit
export const apiRateLimit = createTenantRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes per tenant
  message: "API rate limit exceeded for your school, please try again later."
});
