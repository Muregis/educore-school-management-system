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
    console.log('[DEBUG] /parent/my-students - req.user:', { user_id, school_id, role });

    // Only parents can access this endpoint
    if (role !== "parent") {
      console.log('[DEBUG] /parent/my-students - Not a parent role');
      return res.status(403).json({ message: "Forbidden" });
    }

    // First: Get the parent user record to find their linked student_id and phone
    const { data: parentUser, error: parentError } = await supabase
      .from("users")
      .select("user_id, student_id, phone, email")
      .eq("user_id", user_id)
      .eq("school_id", school_id)
      .single();

    console.log('[DEBUG] /parent/my-students - parentUser:', parentUser, 'error:', parentError);

    if (parentError) {
      console.error("[parent/my-students] Parent lookup error:", parentError);
    }

    let students = [];

    // Strategy 1: If parent has a linked student_id, get that student first
    if (parentUser?.student_id) {
      const { data: linkedStudent, error: studentError } = await supabase
        .from("students")
        .select("student_id, first_name, last_name, admission_number, class_name, status, parent_name, parent_phone")
        .eq("student_id", parentUser.student_id)
        .eq("school_id", school_id)
        .eq("is_deleted", false)
        .single();

      if (!studentError && linkedStudent) {
        students.push(linkedStudent);

        // Strategy 2: Find siblings by same parent_phone
        if (linkedStudent.parent_phone) {
          const { data: siblings, error: siblingsError } = await supabase
            .from("students")
            .select("student_id, first_name, last_name, admission_number, class_name, status, parent_name, parent_phone")
            .eq("school_id", school_id)
            .eq("parent_phone", linkedStudent.parent_phone)
            .eq("is_deleted", false)
            .neq("student_id", linkedStudent.student_id) // Exclude the one we already have
            .order("first_name");

          if (!siblingsError && siblings) {
            students.push(...siblings);
          }
        }
      }
    }

    // Strategy 3: If no students found, try by parent_students junction table
    if (students.length === 0) {
      const { data: linkedStudents, error: linkError } = await supabase
        .from("parent_students")
        .select(`
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
        `)
        .eq("parent_id", user_id)
        .eq("students.is_deleted", false);

      if (!linkError && linkedStudents) {
        const mappedStudents = linkedStudents
          .filter(ls => ls.students) // Ensure student exists
          .map(ls => ({
            ...ls.students,
            student_id: ls.students.student_id,
          }));
        students.push(...mappedStudents);
      }
    }

    // Remove duplicates by student_id
    const uniqueStudents = Array.from(
      new Map(students.map(s => [s.student_id, s])).values()
    );

    console.log('[DEBUG] /parent/my-students - returning', uniqueStudents.length, 'students');
    res.json(uniqueStudents);
  } catch (err) {
    console.error("[parent/my-students] Error:", err);
    next(err);
  }
});

export default router;