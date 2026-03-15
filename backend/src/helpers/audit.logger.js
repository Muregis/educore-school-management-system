import { pgPool } from "../config/pg.js";

// NEW: Enhanced audit logging for sensitive actions
export async function logAuditEvent(req, action, details = {}) {
  try {
    const { user_id, school_id } = req.user || {};
    const { entityId, entityType, oldValues, newValues, description } = details;

    await pgPool.query(
      `INSERT INTO audit_logs (
        user_id, school_id, action, entity_type, entity_id,
        old_values, new_values, description, ip_address, user_agent, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        user_id || null,
        school_id || null,
        action,
        entityType || null,
        entityId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        description || null,
        req.ip || null,
        req.get('User-Agent') || null
      ]
    );
  } catch (error) {
    console.error('Audit log failed:', error.message);
    // Don't throw - audit logging failure shouldn't break the main operation
  }
}

// Predefined audit actions for sensitive operations
export const AUDIT_ACTIONS = {
  GRADE_CREATE: 'grade.create',
  GRADE_UPDATE: 'grade.update',
  GRADE_DELETE: 'grade.delete',
  FEE_UPDATE: 'fee.update',
  FEE_CREATE: 'fee.create',
  STUDENT_UPDATE: 'student.update',
  STUDENT_DELETE: 'student.delete',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_UPDATE: 'payment.update',
  PAYMENT_DELETE: 'payment.delete',
  USER_ROLE_CHANGE: 'user.role_change',
  USER_STATUS_CHANGE: 'user.status_change',
  ADMIN_ACTION: 'admin.action',
  CROSS_TENANT_ATTEMPT: 'security.cross_tenant_attempt'
};
