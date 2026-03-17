import { pool } from "../config/db.js";

/**
 * Log an activity — fire-and-forget, never throws, never blocks.
 *
 * Usage inside any route handler:
 *   logActivity(req, { action: "payment.create", entity: "payment", entityId: id, description: "KES 5,000 received" });
 */
export function logActivity(req, { action, entity = null, entityId = null, description = null }) {
  try {
    const schoolId = req.user?.schoolId ?? null;
    const userId   = req.user?.userId   ?? null;
    const role     = req.user?.role     ?? null;
    const ip       = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
                  || req.socket?.remoteAddress
                  || null;

    pool
      .from('activity_logs')
      .insert({
        school_id: schoolId,
        user_id: userId,
        role: role,
        action: action,
        entity: entity,
        entity_id: entityId,
        description: description,
        ip_address: ip
      })
      .catch(err => console.error("[activity_log] DB error:", err.message));
  } catch (err) {
    console.error("[activity_log] Unexpected error:", err.message);
  }
}
