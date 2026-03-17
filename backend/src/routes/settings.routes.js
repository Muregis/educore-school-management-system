import { Router } from "express";
import { pool } from "../config/db.js";
import { supabase } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// NEW: GET /api/settings/users (frontend expects this path)
router.get("/users", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    // Prefer Supabase fluent API (no raw SQL, no MySQL fallback)
    const { data, error } = await supabase
      .from("users")
      .select("user_id, full_name, email, phone, role, status, created_at")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("role")
      .order("full_name");
    if (error) throw error;

    res.json(data || []);
  } catch (err) { next(err); }
});

async function ensurePermissionsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS role_permissions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      school_id BIGINT UNSIGNED NOT NULL,
      role_name VARCHAR(40) NOT NULL,
      can_edit TINYINT(1) NOT NULL DEFAULT 0,
      pages_json TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_role_permissions_school_role (school_id, role_name),
      CONSTRAINT fk_role_permissions_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
    ) ENGINE=InnoDB`
  );
}

router.get("/permissions", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await ensurePermissionsTable();
    const [rows] = await pool.query(
      `SELECT role_name, can_edit, pages_json
       FROM role_permissions
       WHERE school_id = ?`,
      [schoolId]
    );

    const permissions = Object.fromEntries(
      rows.map(r => [r.role_name, { edit: Boolean(r.can_edit), pages: JSON.parse(r.pages_json || "[]") }])
    );

    res.json({ permissions });
  } catch (err) {
    next(err);
  }
});

router.put("/permissions", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ message: "permissions object is required" });
    }

    await ensurePermissionsTable();

    for (const [roleName, cfg] of Object.entries(permissions)) {
      const pages = Array.isArray(cfg?.pages) ? cfg.pages : [];
      const canEdit = cfg?.edit ? 1 : 0;

      await pool.query(
        `INSERT INTO role_permissions (school_id, role_name, can_edit, pages_json)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE can_edit = VALUES(can_edit), pages_json = VALUES(pages_json)`,
        [schoolId, roleName, canEdit, JSON.stringify(pages)]
      );
    }

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

export default router;
