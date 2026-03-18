import { supabase } from "../config/supabaseClient.js";

// NEW: Enhanced audit logging for sensitive actions
export async function logAuditEvent(req, action, details = {}) {
  try {
    const { user_id, school_id } = req.user || {};
    const { entityId, entityType, oldValues, newValues, description } = details;

    await supabase
      .from('audit_logs')
      .insert({
        user_id: user_id || null,
        school_id: school_id || null,
        action: action,
        entity_type: entityType || null,
        entity_id: entityId || null,
        old_values: oldValues ? JSON.stringify(oldValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null,
        description: description || null,
        ip_address: req.ip || null,
        user_agent: req.get('User-Agent') || null,
        timestamp: new Date().toISOString()
      });
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
