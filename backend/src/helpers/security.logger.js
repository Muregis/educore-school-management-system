import { pool } from "../config/db.js";

/**
 * Security event logging for audit trails and threat detection
 * 
 * Usage:
 *   logSecurityEvent(req, { 
 *     eventType: "auth_failure", 
 *     severity: "high",
 *     description: "Invalid login attempt",
 *     details: { email, ip, userAgent }
 *   });
 */
export function logSecurityEvent(req, { eventType, severity = "medium", description, details = {} }) {
  try {
    const schoolId = req.user?.schoolId ?? null;
    const userId   = req.user?.userId   ?? null;
    const role     = req.user?.role     ?? null;
    const ip       = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
                  || req.socket?.remoteAddress
                  || null;
    const userAgent = req.get("User-Agent") || null;

    pool.query(
      `INSERT INTO security_logs
      (school_id, user_id, role, event_type, severity, description, ip_address, user_agent, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [schoolId, userId, role, eventType, severity, description, ip, userAgent, JSON.stringify(details)]
    ).catch(err => console.error("[security_log] DB error:", err.message));
  } catch (err) {
    console.error("[security_log] Unexpected error:", err.message);
  }
}

/**
 * Log authentication failures with enhanced details
 */
export function logAuthFailure(req, { email, reason, schoolId = null }) {
  logSecurityEvent(req, {
    eventType: "auth_failure",
    severity: "high",
    description: `Authentication failure: ${reason}`,
    details: { email, schoolId, attemptTime: new Date().toISOString() }
  });
}

/**
 * Log payment security events
 */
export function logPaymentSecurity(req, { eventType, description, details }) {
  logSecurityEvent(req, {
    eventType: `payment_${eventType}`,
    severity: "critical",
    description,
    details
  });
}

/**
 * Log suspicious activities
 */
export function logSuspiciousActivity(req, { description, details }) {
  logSecurityEvent(req, {
    eventType: "suspicious_activity",
    severity: "high",
    description,
    details
  });
}
