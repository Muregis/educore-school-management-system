import { rateLimit } from "express-rate-limit";

// General API rate limiting
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { message: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per windowMs
  message: { message: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth requests
});

// Payment processing rate limiting
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 payment requests per minute
  message: { message: "Too many payment requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook rate limiting (higher limit for legitimate webhook calls)
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 webhook calls per minute
  message: { message: "Too many webhook requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Import rate limiting (strict to prevent abuse)
export const importRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 imports per hour
  message: { message: "Too many import requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin action rate limiting
export const adminActionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 admin actions per 15 minutes
  message: { message: "Too many admin actions, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset rate limiting (very strict)
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password resets per hour
  message: { message: "Too many password reset attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
