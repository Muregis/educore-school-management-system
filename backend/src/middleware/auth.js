import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function logAuthEvent(level, event, details) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, component: "auth", event, ...details };
  if (level === "ERROR" || level === "WARN") {
    console.error(`[AUTH ${level}] ${event}:`, JSON.stringify(logEntry));
  } else {
    console.log(`[AUTH ${level}] ${event}:`, JSON.stringify(logEntry));
  }
}

const SUPERADMIN_EMAIL = env.superadminEmail || "muregivictor@gmail.com";

export function authRequired(req, res, next) {
  req.requestId = generateRequestId();

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

    console.log('[AUTH DEBUG] Token payload:', {
      role: payload.role,
      user_id: payload.user_id || payload.userId,
      school_id: payload.school_id || payload.schoolId,
      email: payload.email,
      keys: Object.keys(payload)
    });

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

    console.log('[AUTH DEBUG] Role detection:', {
      isSuperadminToken,
      isDirectorToken,
      payloadRole: payload.role,
      SUPERADMIN_EMAIL
    });

    // ── SUPERADMIN — full system access, no school restriction ──
    if (isSuperadminToken) {
      const headerSchoolId = req.headers["x-active-school-id"] || 
                             req.headers["x-school-id"] || 
                             req.headers["x-effective-school-id"];
      const effectiveSchoolId = headerSchoolId 
        ? Number(headerSchoolId) 
        : (payload.school_id || payload.schoolId || null);

      req.user = {
        ...payload,
        user_id: payload.user_id || payload.userId,
        userId: payload.user_id || payload.userId,
        role: 'superadmin',
        school_id: effectiveSchoolId,
        schoolId: effectiveSchoolId,
        isSuperadmin: true,
        isDirector: false,
        originalSchoolId: payload.school_id || payload.schoolId || null,
        tokenRole: payload.role
      };

      if (headerSchoolId) {
        console.log(`[AUTH DEBUG] Superadmin context switch: ${effectiveSchoolId}`);
      }

      return next();
    }

    // ── DIRECTOR — full access locked to own school ──
    // Your director (muregivictor) can switch between owned schools via header
    // All other directors locked strictly to their own school_id
    if (isDirectorToken) {
      const headerSchoolId = req.headers["x-active-school-id"] || 
                             req.headers["x-school-id"];
      const allowedSwitch = payload.email === SUPERADMIN_EMAIL && headerSchoolId;
      const effectiveSchoolId = allowedSwitch
        ? Number(headerSchoolId)
        : Number(payload.school_id || payload.schoolId);

      req.user = {
        ...payload,
        user_id: payload.user_id || payload.userId,
        userId: payload.user_id || payload.userId,
        role: 'director',
        school_id: effectiveSchoolId,
        schoolId: effectiveSchoolId,
        isSuperadmin: false,
        isDirector: true,
        originalSchoolId: Number(payload.school_id || payload.schoolId),
        tokenRole: payload.role
      };

      console.log(`[AUTH DEBUG] Director context: school=${effectiveSchoolId} email=${payload.email}`);
      return next();
    }

    // ── REGULAR USERS — must have valid school_id ──
    if (!payload.school_id && !payload.schoolId) {
      logAuthEvent("ERROR", "JWT_MISSING_SCHOOL_ID", {
        requestId: req.requestId,
        path: req.path,
        userId: payload.user_id || payload.userId,
        role: payloadRole
      });
      return res.status(401).json({
        error: "Invalid token: missing school identification",
        code: "AUTH_MISSING_SCHOOL_ID",
        requestId: req.requestId
      });
    }

    req.user = {
      ...payload,
      user_id: payload.user_id || payload.userId,
      userId: payload.user_id || payload.userId,
      school_id: Number(payload.school_id || payload.schoolId),
      schoolId: Number(payload.school_id || payload.schoolId),
      isSuperadmin: false,
      isDirector: false
    };

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

    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp;
    const tokenAge = now - (payload.iat || now);

    if (exp && exp - now < 3600) {
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

export { authRequired as requireAuth };