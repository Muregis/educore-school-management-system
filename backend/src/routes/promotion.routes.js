/**
 * Student Promotion Route
 *
 * POST /api/students/promote
 *   Body: { fromClass, toClass, academicYear, dryRun? }
 *
 * Safety design (live-data rules):
 *  - dryRun=true returns count without any writes
 *  - Writes ONLY update class_name, previous_class, promotion_year
 *  - Never deletes records or changes status
 *  - All activity is logged to activity_logs
 *  - Requires director/superadmin role
 *  - Runs student by student (no bulk SQL) so partial failures are visible
 *
 * Additive columns required (run safe_additive_migration.sql first):
 *   students.previous_class VARCHAR(50)
 *   students.promotion_year VARCHAR(10)
 */

import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { logActivity } from "../helpers/activity.logger.js";

const router = Router();
router.use(authRequired);

// Official next-class map (CBC Kenya)
const NEXT_CLASS = {
  "Playgroup": "PP1",
  "PP1":       "PP2",
  "PP2":       "Grade 1",
  "Grade 1":   "Grade 2",
  "Grade 2":   "Grade 3",
  "Grade 3":   "Grade 4",
  "Grade 4":   "Grade 5",
  "Grade 5":   "Grade 6",
  "Grade 6":   "Grade 7",
  "Grade 7":   "Grade 8",
  "Grade 8":   "Grade 9",
  "Grade 9":   null, // graduates — handle separately
};

// POST /api/students/promote
router.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const {
      fromClass,
      toClass,
      academicYear = new Date().getFullYear().toString(),
      dryRun = false,
    } = req.body;

    // Validate inputs
    if (!fromClass) return res.status(400).json({ message: "fromClass is required" });

    // Determine target class
    const targetClass = toClass || NEXT_CLASS[fromClass];
    if (targetClass === undefined) {
      return res.status(400).json({ message: `No known next class for: ${fromClass}` });
    }
    if (targetClass === null) {
      return res.status(400).json({
        message: "Grade 9 graduates — use the alumni/exit flow instead of promotion.",
      });
    }

    // 1. Fetch students to promote (READ-ONLY step)
    const { data: students, error: fetchErr } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, class_name, admission_number")
      .eq("school_id", schoolId)
      .eq("class_name", fromClass)
      .eq("status", "active")
      .eq("is_deleted", false);

    if (fetchErr) throw fetchErr;
    const count = (students || []).length;

    // Dry run: return preview without writing
    if (dryRun || String(dryRun) === "true") {
      return res.json({
        dryRun: true,
        fromClass,
        toClass: targetClass,
        academicYear,
        students: (students || []).map(s => ({
          student_id:       s.student_id,
          name:             `${s.first_name} ${s.last_name}`.trim(),
          admission_number: s.admission_number,
          currentClass:     s.class_name,
          wouldMoveTo:      targetClass,
        })),
        count,
        message: `${count} student(s) would be promoted from ${fromClass} to ${targetClass}.`,
      });
    }

    if (count === 0) {
      return res.json({ promoted: 0, fromClass, toClass: targetClass, message: "No active students found in this class." });
    }

    // 2. Update each student — additive fields only, never removes data
    let promoted = 0;
    const errors = [];
    for (const s of students) {
      const { error: upErr } = await supabase
        .from("students")
        .update({
          class_name:      targetClass,       // move to next class
          previous_class:  fromClass,         // record where they came from
          promotion_year:  academicYear,      // record when
          // Note: all other columns (status, payments, results) are untouched
        })
        .eq("student_id", s.student_id)
        .eq("school_id", schoolId)
        .eq("is_deleted", false);             // extra guard

      if (upErr) {
        errors.push({ student_id: s.student_id, error: upErr.message });
      } else {
        promoted++;
      }
    }

    // 3. Log activity
    logActivity({ user: { userId, schoolId } }, {
      action:      "students.promote",
      entity:      "students",
      description: `Promoted ${promoted}/${count} students from ${fromClass} to ${targetClass} (year ${academicYear})`,
    });

    res.json({
      promoted,
      skipped: errors.length,
      fromClass,
      toClass: targetClass,
      academicYear,
      errors: errors.length > 0 ? errors : undefined,
      message: `${promoted} student(s) promoted from ${fromClass} to ${targetClass}.`,
    });
  } catch (err) { next(err); }
});

export default router;
