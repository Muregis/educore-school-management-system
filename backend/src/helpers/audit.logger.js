import { supabase } from "../config/supabaseClient.js";

/**
 * Log an audit event — fire-and-forget, never throws.
 * FIX: Removed 'timestamp' field - audit_logs table uses 'created_at' (DEFAULT NOW())
 * The old code was trying to insert into a column called 'timestamp' which doesn't exist
 * on the fixed schema. 'created_at' defaults automatically.
 */
export async function logAuditEvent(req, action, details = {}) {
  try {
    const user_id   = req.user?.user_id   ?? req.user?.userId   ?? null;
    const school_id = req.user?.school_id ?? req.user?.schoolId ?? null;
    const { entityId, entityType, oldValues, newValues, description } = details;

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id,
        school_id,
        action,
        entity_type:  entityType  || null,
        entity_id:    entityId    || null,
        old_values:   oldValues   ? JSON.stringify(oldValues)  : null,
        new_values:   newValues   ? JSON.stringify(newValues)  : null,
        description:  description || null,
        ip_address:   req.ip      || null,
        user_agent:   req.get?.('User-Agent') || null,
        // FIX: Do NOT include 'timestamp' — column is 'created_at' with DEFAULT NOW()
      });

    if (error) {
      console.error('[audit_log] DB error:', error.message);
    }
  } catch (err) {
    console.error('[audit_log] Unexpected error:', err.message);
  }
}

// Predefined audit actions for sensitive operations
export const AUDIT_ACTIONS = {
  GRADE_CREATE:          'grade.create',
  GRADE_UPDATE:          'grade.update',
  GRADE_DELETE:          'grade.delete',
  FEE_UPDATE:            'fee.update',
  FEE_CREATE:            'fee.create',
  STUDENT_UPDATE:        'student.update',
  STUDENT_DELETE:        'student.delete',
  PAYMENT_CREATE:        'payment.create',
  PAYMENT_UPDATE:        'payment.update',
  PAYMENT_DELETE:        'payment.delete',
  USER_ROLE_CHANGE:      'user.role_change',
  USER_STATUS_CHANGE:    'user.status_change',
  ADMIN_ACTION:          'admin.action',
  CROSS_TENANT_ATTEMPT:  'security.cross_tenant_attempt',
};