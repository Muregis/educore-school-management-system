import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Generate request ID for tracing
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Structured security logger
function logAuthEvent(level, event, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    component: "auth",
    event,
    ...details
  };
  
  if (level === "ERROR" || level === "WARN") {
    console.error(`[AUTH ${level}] ${event}:`, JSON.stringify(logEntry));
  } else {
    console.log(`[AUTH ${level}] ${event}:`, JSON.stringify(logEntry));
  }
}

const SUPERADMIN_EMAIL = env.superadminEmail || "muregivictor@gmail.com";

export function authRequired(req, res, next) {
  // Attach request ID for tracing
  req.requestId = generateRequestId();
  // Allowlist unauthenticated webhooks / callbacks
  const openPaths = [
    "/paystack/webhook",
    "/paystack/callback",
    "/mpesa/callback",
    "/mpesa/c2b/confirm",
    "/mpesa/c2b/validate",
  ];
  if (openPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    logAuthEvent("WARN", "MISSING_TOKEN", {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      hasAuthHeader: Boolean(header)
    });
    return res.status(401).json({ 
      error: "Missing auth token",
      code: "AUTH_MISSING_TOKEN",
      requestId: req.requestId
    });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    
    // DEBUG: Log payload for troubleshooting
    console.log('[AUTH DEBUG] Token payload:', {
      role: payload.role,
      user_id: payload.user_id || payload.userId,
      school_id: payload.school_id || payload.schoolId,
      email: payload.email,
      keys: Object.keys(payload)
    });
    
    // Validate required claims
    if (!payload.user_id && !payload.userId) {
      logAuthEvent("ERROR", "JWT_MISSING_USER_ID", {
        requestId: req.requestId,
        path: req.path,
        payloadKeys: Object.keys(payload)
      });
      return res.status(401).json({ 
        error: "Invalid token: missing user identification",
        code: "AUTH_INVALID_TOKEN",
        requestId: req.requestId
      });
    }

    const payloadRole = (payload.role || "").toLowerCase();
    const isSuperadminToken = (payload.email === SUPERADMIN_EMAIL) || (payloadRole === 'superadmin');
    const isDirectorToken = payloadRole === 'director';
    const isSystemAdmin = isSuperadminToken || isDirectorToken;
    
    // DEBUG: Log role detection
    console.log('[AUTH DEBUG] Role detection:', {
      isSuperadminToken,
      isDirectorToken,
      isSystemAdmin,
      payloadRole: payload.role,
      SUPERADMIN_EMAIL
    });

    if (!payload.school_id && !payload.schoolId && !isSystemAdmin) {
      logAuthEvent("ERROR", "JWT_MISSING_SCHOOL_ID", {
        requestId: req.requestId,
        path: req.path,
        userId: payload.user_id || payload.userId,
        role: payloadRole
      });
      return res.status(401).json({ 
        error: "Invalid token: missing school identification for non-system-admin",
        code: "AUTH_MISSING_SCHOOL_ID",
        requestId: req.requestId,
        debugRole: payloadRole,
        debugPayloadKeys: Object.keys(payload),
        isSystemAdmin,
        emailMatch: payload.email === SUPERADMIN_EMAIL
      });
    }

    // Allow superadmin/director to bypass school_id requirement (they have access to all schools)
    if (isSystemAdmin) {
      // NEW: Support header-based context switching for directors
      const headerSchoolId = req.headers["x-school-id"] || req.headers["x-effective-school-id"];
      const effectiveSchoolId = headerSchoolId ? Number(headerSchoolId) : (payload.school_id || payload.schoolId || null);

      // Force the role to the highest available permission for system admins
      const effectiveRole = isSuperadminToken ? 'superadmin' : 'director';

      req.user = {
        ...payload,
        user_id: payload.user_id || payload.userId,
        userId: payload.user_id || payload.userId,
        role: effectiveRole, 
        school_id: effectiveSchoolId, 
        schoolId: effectiveSchoolId,
        isSuperadmin: isSuperadminToken,
        isDirector: isDirectorToken,
        originalSchoolId: payload.school_id || payload.schoolId || null,
        tokenRole: payload.role // keep for debugging
      };

      if (headerSchoolId) {
        console.log(`[AUTH DEBUG] System admin context override applied: ${effectiveSchoolId} (Role: ${effectiveRole})`);
      }

      return next();
    }

    // Normalize payload for consistent access (non-superadmin)
    req.user = {
      ...payload,
      user_id: payload.user_id || payload.userId,
      userId: payload.user_id || payload.userId,
      school_id: Number(payload.school_id || payload.schoolId),
      schoolId: Number(payload.school_id || payload.schoolId),
      isSuperadmin: false
    };

    // Validate school_id is a valid positive integer
    if (!req.user.school_id || !Number.isInteger(req.user.school_id) || req.user.school_id < 1) {
      logAuthEvent("ERROR", "JWT_INVALID_SCHOOL_ID", {
        requestId: req.requestId,
        path: req.path,
        userId: req.user.user_id,
        schoolId: req.user.school_id,
        role: req.user.role,
        payloadKeys: Object.keys(payload)
      });
      return res.status(401).json({ 
        error: "Invalid school_id in token",
        code: "AUTH_INVALID_TENANT"
      });
    }

    // Calculate token expiration warning (if exp exists)
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp;
    const tokenAge = now - (payload.iat || now);
    
    if (exp && exp - now < 3600) { // Less than 1 hour remaining
      logAuthEvent("INFO", "TOKEN_NEAR_EXPIRY", {
        requestId: req.requestId,
        userId: req.user.user_id,
        schoolId: req.user.school_id,
        expiresIn: exp - now,
        tokenAge
      });
      res.setHeader("X-Token-Expires-In", exp - now);
    }

    logAuthEvent("INFO", "AUTH_SUCCESS", {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      userId: req.user.user_id,
      schoolId: req.user.school_id,
      role: req.user.role,
      tokenAge
    });

    return next();
  } catch (err) {
    const errorType = err.name === "TokenExpiredError" ? "EXPIRED" : "INVALID";
    
    logAuthEvent("WARN", `JWT_${errorType}`, {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      errorName: err.name,
      expiredAt: err.expiredAt
    });
    
    return res.status(401).json({ 
      error: errorType === "EXPIRED" 
        ? "Token expired. Please login again." 
        : "Invalid or expired token",
      code: errorType === "EXPIRED" ? "AUTH_TOKEN_EXPIRED" : "AUTH_INVALID_TOKEN",
      requestId: req.requestId
    });
  }
}

// Alias for backward compatibility
export { authRequired as requireAuth };
