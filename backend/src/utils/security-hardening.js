import helmet from 'helmet';
import csrf from 'csurf';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Advanced security hardening utilities for multi-tenant SaaS
export class SecurityHardeningManager {
  constructor(options = {}) {
    this.options = {
      csrfSecret: options.csrfSecret || process.env.CSRF_SECRET,
      rateLimitWindowMs: options.rateLimitWindowMs || 15 * 60 * 1000, // 15 minutes
      maxRequestsPerWindow: options.maxRequestsPerWindow || 1000,
      enableBotDetection: options.enableBotDetection || true,
      enableGeoBlocking: options.enableGeoBlocking || false,
      allowedCountries: options.allowedCountries || [],
      ...options
    };
  }

  // Create comprehensive security middleware
  createSecurityMiddleware() {
    const middlewares = [];

    // 1. Helmet.js for security headers
    middlewares.push(this.createHelmetMiddleware());

    // 2. CSRF protection
    middlewares.push(this.createCsrfMiddleware());

    // 3. Advanced rate limiting
    middlewares.push(this.createAdvancedRateLimitMiddleware());

    // 4. Bot detection
    if (this.options.enableBotDetection) {
      middlewares.push(this.createBotDetectionMiddleware());
    }

    // 5. Geo-blocking (if enabled)
    if (this.options.enableGeoBlocking) {
      middlewares.push(this.createGeoBlockingMiddleware());
    }

    // 6. Input validation middleware
    middlewares.push(this.createInputValidationMiddleware());

    // 7. Security monitoring
    middlewares.push(this.createSecurityMonitoringMiddleware());

    return middlewares;
  }

  // Helmet.js security headers
  createHelmetMiddleware() {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"]
        }
      },

      // HTTP Strict Transport Security
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },

      // X-Frame-Options
      frameguard: { action: 'deny' },

      // X-Content-Type-Options
      noSniff: true,

      // Referrer Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

      // X-XSS-Protection
      xssFilter: true,

      // Permissions Policy
      permissionsPolicy: {
        features: {
          geolocation: ['none'],
          microphone: ['none'],
          camera: ['none'],
          payment: ['none'],
          usb: ['none']
        }
      },

      // Cross-Origin Embedder Policy
      crossOriginEmbedderPolicy: true,

      // Cross-Origin Resource Policy
      crossOriginResourcePolicy: { policy: "cross-origin" }
    });
  }

  // CSRF protection middleware
  createCsrfMiddleware() {
    if (!this.options.csrfSecret) {
      console.warn('CSRF secret not configured, CSRF protection disabled');
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return csrf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      }
    });
  }

  // Advanced rate limiting with tenant awareness
  createAdvancedRateLimitMiddleware() {
    const rateLimiter = rateLimit({
      windowMs: this.options.rateLimitWindowMs,
      max: this.options.maxRequestsPerWindow,
      message: {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Skip rate limiting for health checks
      skip: (req: Request) => {
        return req.path === '/api/health' || req.path === '/api/health/tenant';
      }
    });

    return rateLimiter;
  }

  // Bot detection middleware
  createBotDetectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const userAgent = req.get('User-Agent') || '';
      const suspiciousPatterns = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
        /python/i,
        /java/i,
        /go-http/i
      ];

      const isBot = suspiciousPatterns.some(pattern => pattern.test(userAgent));
      
      if (isBot && !req.path.includes('/api/webhook')) {
        // Log bot attempt
        console.warn('Bot detected:', {
          ip: req.ip,
          userAgent,
          path: req.path,
          timestamp: new Date().toISOString()
        });

        // Block suspicious bots from non-webhook endpoints
        return res.status(403).json({
          error: 'Access denied',
          code: 'BOT_DETECTED'
        });
      }

      next();
    };
  }

  // Geo-blocking middleware
  createGeoBlockingMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIp = req.ip || req.connection.remoteAddress;
      
      try {
        // This would integrate with a GeoIP service
        // For now, just log the request
        console.log('Geo-check request:', {
          ip: clientIp,
          path: req.path,
          timestamp: new Date().toISOString()
        });

        // In production, you would:
        // 1. Look up IP location using GeoIP database
        // 2. Check if country is in allowed list
        // 3. Block if not allowed
        
        next();
      } catch (error) {
        console.error('Geo-blocking error:', error);
        next(); // Fail open
      }
    };
  }

  // Input validation middleware
  createInputValidationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for common injection patterns
      const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS
        /union\s+select/gi, // SQL injection
        /javascript:/gi, // JavaScript injection
        /on\w+\s*=/gi, // Event handlers
        /<iframe/gi, // Iframe injection
        /<object/gi, // Object injection
        /<embed/gi // Embed injection
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(v => checkValue(v));
        }
        return false;
      };

      // Check request body
      if (req.body && checkValue(req.body)) {
        console.warn('Suspicious input detected:', {
          ip: req.ip,
          path: req.path,
          body: req.body,
          timestamp: new Date().toISOString()
        });

        return res.status(400).json({
          error: 'Invalid input detected',
          code: 'INVALID_INPUT'
        });
      }

      // Check query parameters
      if (req.query && checkValue(req.query)) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          code: 'INVALID_QUERY'
        });
      }

      next();
    };
  }

  // Security monitoring middleware
  createSecurityMonitoringMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Store original send method
      const originalSend = res.send;
      
      res.send = function(data: any) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Log security events
        if (res.statusCode >= 400) {
          console.warn('Security event detected:', {
            ip: req.ip,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          });
        }

        // Check for suspicious patterns
        if (res.statusCode === 401 || res.statusCode === 403) {
          this.logSecurityEvent(req, res, 'ACCESS_DENIED');
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  // Log security events
  logSecurityEvent(req: Request, res: Response, eventType: string) {
    const securityEvent = {
      eventType,
      ip: req.ip,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      schoolId: req.user?.schoolId,
      userId: req.user?.userId,
      timestamp: new Date().toISOString()
    };

    // In production, this would go to a security monitoring system
    console.log('SECURITY_EVENT:', JSON.stringify(securityEvent));
  }

  // Password policy validator
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Minimum length
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Maximum length
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    // Complexity requirements
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common password patterns
    const commonPatterns = [
      /password/i,
      /123456/,
      /qwerty/i,
      /admin/i,
      /letmein/i
    ];

    if (commonPatterns.some(pattern => pattern.test(password))) {
      errors.push('Password cannot contain common patterns');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate secure random token
  generateSecureToken(length: number = 32): string {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash password securely
  async hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  // Create tenant-aware rate limiter
  createTenantRateLimit(options: { maxRequests?: number; windowMs?: number }) {
    const tenantRateLimit = rateLimit({
      windowMs: options.windowMs || this.options.rateLimitWindowMs,
      max: options.maxRequests || this.options.maxRequestsPerWindow,
      keyGenerator: (req: Request) => {
        // Use tenant ID as key for rate limiting
        return `tenant_${req.user?.schoolId || 'anonymous'}_${req.ip}`;
      },
      message: {
        error: 'Tenant rate limit exceeded',
        code: 'TENANT_RATE_LIMIT_EXCEEDED'
      }
    });

    return tenantRateLimit;
  }

  // Security headers for API responses
  addSecurityHeaders(res: Response) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
  }
}

// Multi-factor authentication utilities
export class MFAManager {
  constructor(options = {}) {
    this.options = {
      issuer: options.issuer || 'EduCore',
      window: options.window || 1,
      ...options
    };
  }

  // Generate TOTP secret
  generateTOTPSecret(userEmail: string): string {
    const speakeasy = require('speakeasy');
    return speakeasy.generateSecret({
      name: `${this.options.issuer} (${userEmail})`,
      issuer: this.options.issuer,
      length: 32
    }).base32;
  }

  // Generate QR code for TOTP setup
  generateTOTPQRCode(secret: string, userEmail: string): string {
    const speakeasy = require('speakeasy');
    const QRCode = require('qrcode');
    
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret,
      label: `${this.options.issuer} (${userEmail})`,
      issuer: this.options.issuer
    });

    return QRCode.toDataURL(otpauthUrl);
  }

  // Verify TOTP token
  verifyTOTPToken(token: string, secret: string): boolean {
    const speakeasy = require('speakeasy');
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: this.options.window
    });
  }

  // Generate backup codes
  generateBackupCodes(count: number = 10): string[] {
    const crypto = require('crypto');
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    
    return codes;
  }
}

// Security monitoring and alerting
export class SecurityMonitor {
  constructor() {
    this.suspiciousActivityThreshold = 10;
    this.alertCooldownMs = 5 * 60 * 1000; // 5 minutes
    this.lastAlerts = new Map();
  }

  // Monitor for suspicious activity
  async monitorSuspiciousActivity(event: {
    ip: string;
    schoolId?: number;
    userId?: number;
    eventType: string;
    timestamp: Date;
  }) {
    const key = `${event.ip}_${event.schoolId || 'no-school'}`;
    const now = Date.now();
    
    // Check if we should send an alert
    const lastAlert = this.lastAlerts.get(key);
    if (lastAlert && (now - lastAlert) < this.alertCooldownMs) {
      return; // Still in cooldown period
    }

    // Count recent suspicious events
    const recentEvents = await this.countRecentEvents(event);
    
    if (recentEvents >= this.suspiciousActivityThreshold) {
      await this.sendSecurityAlert(event, recentEvents);
      this.lastAlerts.set(key, now);
    }
  }

  // Count recent suspicious events
  async countRecentEvents(event: {
    ip: string;
    schoolId?: number;
    userId?: number;
    eventType: string;
    timestamp: Date;
  }): Promise<number> {
    // This would query your audit logs or security events
    // For now, return a mock count
    return 5;
  }

  // Send security alert
  async sendSecurityAlert(event: any, eventCount: number) {
    const alert = {
      type: 'SECURITY_ALERT',
      severity: 'HIGH',
      message: `Suspicious activity detected: ${event.eventType}`,
      details: {
        ip: event.ip,
        schoolId: event.schoolId,
        userId: event.userId,
        eventCount,
        timestamp: new Date().toISOString()
      }
    };

    // In production, this would send to your monitoring system
    console.warn('SECURITY_ALERT:', JSON.stringify(alert));
    
    // You could also send to Slack, email, PagerDuty, etc.
  }
}

export default {
  SecurityHardeningManager,
  MFAManager,
  SecurityMonitor
};
