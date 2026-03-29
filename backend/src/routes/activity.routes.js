import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { supabase } from "../config/supabaseClient.js";
import { logTenantContext, logTenantQuery } from "../helpers/tenant-debug.logger.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin"));

function handleActivityLogsDbError(err, res, next, meta = {}) {
  const msg = String(err?.message || "");
  const isMissingActivityLogsTable =
    err?.code === "PGRST205" ||
    (msg.includes("activity_logs") && (msg.includes("doesn't exist") || msg.includes("does not exist")));

  if (isMissingActivityLogsTable) {
    const message =
      "Activity logs table is missing. Run the migration in database/Activities logs migration.sql and restart the backend.";

    // Keep the UI usable in dev even if migrations haven't been run yet.
    if (process.env.NODE_ENV !== "production") {
      return res.json({
        logs: [],
        total: 0,
        limit: meta.limit ?? 100,
        offset: meta.offset ?? 0,
        warning: message,
      });
    }

    return res.status(500).json({ message });
  }

  return next(err);
}

// ── GET /api/activity-logs ────────────────────────────────────────────────────
// Recent activity, paginated. Admin only.
router.get("/", async (req, res, next) => {
  let limit;
  let offset;
  try {
    const { schoolId } = req.user;
    logTenantContext("activity_logs.list.request", req, { path: req.path });
    limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
    offset = parseInt(req.query.offset) || 0;
    const action = req.query.action || null;
    const role   = req.query.role   || null;

    let q = supabase
      .from('activity_logs')
      .select('log_id, action, entity, entity_id, description, role, ip_address, created_at, users(full_name)', { count: 'exact' })
      .eq('school_id', schoolId);
    logTenantQuery("activity_logs.select", {
      table: "activity_logs",
      schoolId,
      action: action || null,
      role: role || null,
      limit,
      offset,
    });
    
    if (action) { q = q.ilike('action', `${action}%`); }
    if (role)   { q = q.eq('role', role); }
    
    const { data: rows, count: total, error } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    // Flatten user data
    const logs = (rows || []).map(r => ({
      ...r,
      user_name: r.users?.full_name,
      users: undefined
    }));

    res.json({ logs, total: total || 0, limit, offset });
  } catch (err) {
    handleActivityLogsDbError(err, res, next, { limit, offset });
  }
});

// ── GET /api/activity-logs/summary ───────────────────────────────────────────
// Action counts for the last 30 days
router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    logTenantContext("activity_logs.summary.request", req, { path: req.path });
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: rows, error } = await supabase
      .from('activity_logs')
      .select('action')
      .eq('school_id', schoolId)
      .gte('created_at', thirtyDaysAgo.toISOString());
    logTenantQuery("activity_logs.summary.select", {
      table: "activity_logs",
      schoolId,
      from: thirtyDaysAgo.toISOString(),
    });
    if (error) throw error;
    
    // Count actions manually since Supabase doesn't have a simple group by count
    const counts = {};
    rows?.forEach(r => {
      counts[r.action] = (counts[r.action] || 0) + 1;
    });
    
    const result = Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    
    res.json(result);
  } catch (err) { handleActivityLogsDbError(err, res, next); }
});

export default router
