import { supabase } from "../config/supabaseClient.js";
import { logTenantQuery } from "./tenant-debug.logger.js";

/**
 * Log an activity — fire-and-forget, never throws, never blocks.
 *
 * Usage inside any route handler:
 *   logActivity(req, { action: "payment.create", entity: "payment", entityId: id, description: "KES 5,000 received" });
 */
export async function logActivity(req, { action, entity = null, entityId = null, description = null }) {
  try {
    const schoolId = req.user?.schoolId ?? req.user?.school_id ?? req.schoolId ?? null;
    const userId   = req.user?.userId   ?? req.user?.user_id   ?? null;
    const role     = req.user?.role     ?? null;
    const ip       = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
                  || req.socket?.remoteAddress
                  || null;

    logTenantQuery("activity_logs.insert", {
      table: "activity_logs",
      schoolId,
      userId,
      action,
      entity,
      entityId,
    });

    const { error } = await supabase
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
      });
    
    if (error) {
      console.error("[activity_log] DB error:", error.message);
    }
  } catch (err) {
    console.error("[activity_log] Unexpected error:", err.message);
  }
}
