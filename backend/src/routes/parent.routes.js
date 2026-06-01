import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { getPortalStudentIds } from "../utils/portalAccess.js";

const router = Router();
router.use(authRequired);

/**
 * GET /api/parent/my-students
 * Get students linked to the parent account
 * Used by ParentGuard component to verify parent access
 */
router.get("/my-students", async (req, res, next) => {
  try {
    const { user_id, school_id, role } = req.user;

    // Only parents can access this endpoint
    if (role !== "parent") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const studentIds = await getPortalStudentIds(req, supabase);
    if (!studentIds.length) return res.json([]);

    const { data, error } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, admission_number, class_name, status, parent_name, parent_phone")
      .eq("school_id", school_id)
      .eq("is_deleted", false)
      .in("student_id", studentIds)
      .order("first_name");

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("[parent/my-students] Error:", err);
    next(err);
  }
});

export default router;
