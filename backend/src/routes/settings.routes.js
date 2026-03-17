import { Router } from "express";
// OLD: import { pool } from "../config/db.js";
// OLD: import { supabase } from "../config/db.js";
import { supabase } from "../config/supabaseClient.js";
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
  // Check if table exists by trying to query it
  const { error } = await supabase
    .from('role_permissions')
    .select('*', { count: 'exact', head: true });
  
  if (error && error.code === 'PGRST205') {
    // Table doesn't exist - create it via RPC or migration
    console.warn('role_permissions table does not exist. Please run the migration to create it.');
  }
}

router.get("/permissions", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await ensurePermissionsTable();
    
    const { data: rows, error } = await supabase
      .from('role_permissions')
      .select('role_name, can_edit, pages_json')
      .eq('school_id', schoolId);
    if (error) throw error;

    const permissions = Object.fromEntries(
      (rows || []).map(r => [r.role_name, { edit: Boolean(r.can_edit), pages: JSON.parse(r.pages_json || "[]") }])
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
      const canEdit = cfg?.edit ? true : false;

      const { error } = await supabase
        .from('role_permissions')
        .upsert({
          school_id: schoolId,
          role_name: roleName,
          can_edit: canEdit,
          pages_json: JSON.stringify(pages)
        }, { onConflict: 'school_id,role_name' });
      if (error) throw error;
    }

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

export default router;
