import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

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

    // Get students where this user is the parent
    const { data: students, error } = await supabase
      .from("students")
      .select(
        `
        student_id,
        first_name,
        last_name,
        admission_number,
        class_name,
        status,
        parent_name,
        parent_phone
      `
      )
      .eq("school_id", school_id)
      .eq("parent_phone", req.user.phone || "")
      .eq("is_deleted", false)
      .order("first_name");

    if (error) {
      console.error("[parent/my-students] Supabase error:", error);
      throw error;
    }

    // If no students found by phone, try to find by user_id link
    // (some systems link parent accounts via user_id in a junction table)
    if (!students || students.length === 0) {
      // Try alternative: check if there's a parent_students junction table
      const { data: linkedStudents, error: linkError } = await supabase
        .from("parent_students")
        .select(
          `
          students:student_id(
            student_id,
            first_name,
            last_name,
            admission_number,
            class_name,
            status,
            parent_name,
            parent_phone
          )
        `
        )
        .eq("parent_id", user_id)
        .eq("students.is_deleted", false);

      if (!linkError && linkedStudents) {
        const mappedStudents = linkedStudents.map((ls) => ({
          ...ls.students,
          student_id: ls.students.student_id,
        }));
        return res.json(mappedStudents || []);
      }
    }

    res.json(students || []);
  } catch (err) {
    console.error("[parent/my-students] Error:", err);
    next(err);
  }
});

export default router;