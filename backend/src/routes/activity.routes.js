import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin"));

function handleActivityLogsDbError(err, res, next, meta = {}) {
  if (err?.code === "ER_NO_SUCH_TABLE") {
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

  if (err?.code === "ER_BAD_FIELD_ERROR") {
    return res.status(500).json({
      message:
        "Activity logs schema mismatch. Re-run database/Activities logs migration.sql to update your DB schema.",
    });
  }

  return next(err);
}

// ── GET /api/activity-logs ────────────────────────────────────────────────────
// Recent activity, paginated. Admin only.
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action || null;
    const role   = req.query.role   || null;

    const filters = ["l.school_id = ?"];
    const params  = [schoolId];

    if (action) { filters.push("l.action LIKE ?"); params.push(`${action}%`); }
    if (role)   { filters.push("l.role = ?");       params.push(role); }

    const [rows] = await pool.query(
      `SELECT l.log_id, l.action, l.entity, l.entity_id, l.description,
              l.role, l.ip_address, l.created_at,
              u.full_name AS user_name
        FROM activity_logs l
        LEFT JOIN users u ON u.user_id = l.user_id
        WHERE ${filters.join(" AND ")}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM activity_logs l WHERE ${filters.join(" AND ")}`,
      params
    );

    res.json({ logs: rows, total: Number(total), limit, offset });
  } catch (err) {
    handleActivityLogsDbError(err, res, next, { limit, offset });
  }
});

// ── GET /api/activity-logs/summary ───────────────────────────────────────────
// Action counts for the last 30 days
router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT action, COUNT(*) AS count
        FROM activity_logs
        WHERE school_id = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY action
        ORDER BY count DESC
        LIMIT 20`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { handleActivityLogsDbError(err, res, next); }
});

export default router
