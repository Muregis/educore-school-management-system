import { pool } from "../config/db.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";
// OLD: import { agentLog } from "../utils/agentDebugLog.js";

// NEW: Tenant context middleware for automatic tenant isolation
export function tenantContext(req, res, next) {
  // Skip tenant validation for auth routes and health checks
  if (req.path.startsWith('/auth/') || req.path.startsWith('/health')) {
    return next();
  }

  // #region agent log
  // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'analysis-pre',hypothesisId:'H1',location:'backend/src/middleware/tenantContext.js:15',message:'tenantContext entry',data:{path:req.path,method:req.method,hasUser:Boolean(req.user),userKeys:Object.keys(req.user||{}),school_id:req.user?.school_id,schoolId:req.user?.schoolId},timestamp:Date.now()})}).catch(()=>{});
  // OLD: agentLog({sessionId:"cdda91",runId:"pre-fix",hypothesisId:"H1",location:"backend/src/middleware/tenantContext.js:15",message:"tenantContext entry",data:{path:req.path,method:req.method,hasUser:Boolean(req.user),userKeys:Object.keys(req.user||{}),school_id:req.user?.school_id,schoolId:req.user?.schoolId},timestamp:Date.now()});
  // #endregion

  // Verify user exists and has school_id
  // OLD: if (!req.user || !req.user.school_id) {
  // OLD:   return res.status(401).json({ error: "Invalid tenant context" });
  // OLD: }
  const resolvedSchoolId =
    req.user?.school_id ?? req.user?.schoolId ?? req.schoolId ?? null;

  if (!req.user || resolvedSchoolId == null) {
    // #region agent log
    // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'analysis-pre',hypothesisId:'H3',location:'backend/src/middleware/tenantContext.js:22',message:'tenantContext invalid (missing school_id)',data:{path:req.path,method:req.method,hasUser:Boolean(req.user),school_id:req.user?.school_id,schoolId:req.user?.schoolId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
  if (req.path.startsWith('/auth/') || req.path.startsWith('/health')) {
    return next();
  }

  // Check for suspicious cross-school access attempts
  const requestedSchoolId = req.body.school_id || req.query.school_id || req.params.school_id;
  
  // OLD: if (requestedSchoolId && requestedSchoolId !== req.schoolId) {
  // OLD:   ...
  // OLD: }
  if (
    requestedSchoolId != null &&
    String(requestedSchoolId) !== String(req.schoolId)
  ) {
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
