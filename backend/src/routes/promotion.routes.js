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

// Default next-class map (CBC Kenya) - used as fallback when toClass not specified
// null = final class, requires explicit toClass to promote from
const DEFAULT_NEXT_CLASS = {
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
  "Grade 9":   null,        // Final class - requires explicit toClass to promote
  "Form 1":    "Form 2",
  "Form 2":    "Form 3",
  "Form 3":    "Form 4",
  "Form 4":    null,        // Final class - requires explicit toClass
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

    // Determine target class: explicit toClass takes precedence, then try default progression
    let targetClass = toClass;
    let isFinalClass = false;
    
    if (!targetClass) {
      targetClass = DEFAULT_NEXT_CLASS[fromClass];
      if (targetClass === null) {
        isFinalClass = true;
      }
    }
    
    // If this is a final class (Grade 9, Form 4) and no explicit toClass provided
    if (isFinalClass) {
      return res.status(400).json({ 
        message: `${fromClass} is configured as a final class. To promote from ${fromClass}, you must explicitly specify the destination class (toClass).`,
        isFinalClass: true,
        fromClass
      });
    }
    
    // If no default progression found for this class
    if (!targetClass) {
      return res.status(400).json({ 
        message: `Please specify the destination class (toClass). No default progression found for: ${fromClass}` 
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

// GET /api/students/promotion/classes - Get available classes for promotion dropdowns
router.get("/classes", requireRoles("admin", "director", "superadmin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    // Get unique class names from students table
    const { data: classes, error } = await supabase
      .from("students")
      .select("class_name")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .not("class_name", "is", null);
    
    if (error) throw error;
    
    // Get unique, sorted class names
    const uniqueClasses = [...new Set((classes || []).map(c => c.class_name))].filter(Boolean).sort();
    
    // Identify final classes (those with null progression)
    const finalClasses = Object.entries(DEFAULT_NEXT_CLASS)
      .filter(([_, next]) => next === null)
      .map(([cls, _]) => cls);
    
    res.json({
      classes: uniqueClasses,
      finalClasses,
      defaultProgression: DEFAULT_NEXT_CLASS,
      canPromoteFrom: uniqueClasses.filter(c => !finalClasses.includes(c) || DEFAULT_NEXT_CLASS[c] !== undefined),
      count: uniqueClasses.length,
    });
  } catch (err) { next(err); }
});

// POST /api/students/promotion/individual - Promote specific students (with selection)
router.post("/individual", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const {
      studentIds,      // Array of student IDs to promote
      toClass,         // Target class (required)
      academicYear = new Date().getFullYear().toString(),
      fromClass,       // Optional: for verification
    } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: "studentIds array is required" });
    }
    if (!toClass) {
      return res.status(400).json({ message: "toClass (destination class) is required" });
    }

    // Fetch the specific students
    let query = supabase
      .from("students")
      .select("student_id, first_name, last_name, class_name, admission_number")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .eq("is_deleted", false)
      .in("student_id", studentIds);
    
    // Optionally verify they're all in the same source class
    if (fromClass) {
      query = query.eq("class_name", fromClass);
    }

    const { data: students, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!students || students.length === 0) {
      return res.status(404).json({ message: "No eligible students found" });
    }

    // Promote each student
    const promoted = [];
    const errors = [];
    
    for (const s of students) {
      const fromClassName = s.class_name;
      
      const { error: upErr } = await supabase
        .from("students")
        .update({
          class_name: toClass,
          previous_class: fromClassName,
          promotion_year: academicYear,
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", s.student_id)
        .eq("school_id", schoolId);

      if (upErr) {
        errors.push({ student_id: s.student_id, name: `${s.first_name} ${s.last_name}`, error: upErr.message });
      } else {
        promoted.push({
          student_id: s.student_id,
          name: `${s.first_name} ${s.last_name}`,
          fromClass: fromClassName,
          toClass,
        });
      }
    }

    // Log activity
    logActivity({ user: { userId, schoolId } }, {
      action: "students.promote.individual",
      entity: "students",
      description: `Promoted ${promoted.length} individual students to ${toClass}`,
    });

    res.json({
      promoted: promoted.length,
      promotedStudents: promoted,
      errors: errors.length > 0 ? errors : undefined,
      toClass,
      academicYear,
      message: `${promoted.length} student(s) promoted to ${toClass}.`,
    });
  } catch (err) { next(err); }
});

export default router;
