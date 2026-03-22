import { supabase } from "../config/supabaseClient.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";

// FIX: Removed broken `pool` import from config/db.js (pool has no .from() method)
// The tenantContext middleware only needs supabase and audit logging

// NEW: Tenant context middleware for automatic tenant isolation
export function tenantContext(req, res, next) {
  // Skip tenant validation for auth routes and health checks
  const openPaths = [
    '/auth/',
    '/health',
    '/paystack/webhook',
    '/paystack/callback',
    '/mpesa/callback',
    '/mpesa/c2b/confirm',
    '/mpesa/c2b/validate',
  ];
  if (openPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const resolvedSchoolId =
    req.user?.school_id ?? req.user?.schoolId ?? req.schoolId ?? null;

  if (!req.user || resolvedSchoolId == null) {
    return res.status(401).json({ error: "Invalid tenant context" });
  }

  // Ensure consistent schoolId access
  req.user.school_id = resolvedSchoolId;
  req.user.schoolId = resolvedSchoolId;
  req.schoolId = resolvedSchoolId;
  
  next();
}

// NEW: Tenant security check middleware
export function tenantSecurityCheck(req, res, next) {
  // Skip for auth routes and health checks
  const openPaths = [
    '/auth/',
    '/health',
    '/paystack/webhook',
    '/paystack/callback',
    '/mpesa/callback',
    '/mpesa/c2b/confirm',
    '/mpesa/c2b/validate',
  ];
  if (openPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const requestedSchoolId = req.body?.school_id || req.query?.school_id || req.params?.school_id;
  
  if (
    requestedSchoolId != null &&
    String(requestedSchoolId) !== String(req.schoolId)
  ) {
    console.error('SECURITY: Cross-tenant access attempt', {
      userId: req.user?.user_id,
      userSchoolId: req.schoolId,
      requestedSchoolId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    // Log cross-tenant attempt to audit table (fire-and-forget)
    logAuditEvent(req, AUDIT_ACTIONS.CROSS_TENANT_ATTEMPT, {
      description: `Cross-tenant access attempt: user from school ${req.schoolId} trying to access school ${requestedSchoolId}`,
      newValues: { requestedSchoolId, path: req.path, method: req.method }
    }).catch(err => console.error('Audit log failed:', err.message));
    
    return res.status(403).json({ error: "Unauthorized tenant access" });
  }

  next();
}
