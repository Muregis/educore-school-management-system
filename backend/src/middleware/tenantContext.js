import { pgPool } from "../config/pg.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";

// NEW: Tenant context middleware for automatic tenant isolation
export function tenantContext(req, res, next) {
  // Skip tenant validation for auth routes and health checks
  if (req.path.startsWith('/auth/') || req.path.startsWith('/health')) {
    return next();
  }

  // Verify user exists and has school_id
  if (!req.user || !req.user.school_id) {
    return res.status(401).json({ error: "Invalid tenant context" });
  }

  // Ensure consistent schoolId access
  req.schoolId = req.user.school_id;
  
  next();
}

// NEW: Tenant security check middleware
export function tenantSecurityCheck(req, res, next) {
  // Skip for auth routes and health checks
  if (req.path.startsWith('/auth/') || req.path.startsWith('/health')) {
    return next();
  }

  // Check for suspicious cross-school access attempts
  const requestedSchoolId = req.body.school_id || req.query.school_id || req.params.school_id;
  
  if (requestedSchoolId && requestedSchoolId !== req.schoolId) {
    // Log security event (implement actual logging)
    console.error('SECURITY: Cross-tenant access attempt', {
      userId: req.user.user_id,
      userSchoolId: req.schoolId,
      requestedSchoolId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    // NEW: Log cross-tenant attempt to audit table
    logAuditEvent(req, AUDIT_ACTIONS.CROSS_TENANT_ATTEMPT, {
      description: `Cross-tenant access attempt: user from school ${req.schoolId} trying to access school ${requestedSchoolId}`,
      newValues: { requestedSchoolId, path: req.path, method: req.method }
    }).catch(err => console.error('Audit log failed:', err.message));
    
    return res.status(403).json({ error: "Unauthorized tenant access" });
  }

  next();
}
