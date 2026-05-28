import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { getTeacherAssignedClasses } from "../utils/getTeacherClasses.js";

const router = Router();
router.use(authRequired);

// GET /api/grades/compiled - Get compiled results with weighted average across exam types
router.get("/compiled", async (req, res, next) => {
  try {
    const { schoolId, userId, role } = req.user;
    const { term, className, studentId } = req.query;

    let query = supabase
      .from("results")
      .select(`
        result_id,
        student_id,
        subject,
        marks,
        total_marks,
        grade,
        term,
        exam_type,
        exam_sequence,
        exam_name,
        academic_year,
        class_name,
        teacher_comment,
        students!inner(
          student_id,
          admission_number,
          first_name,
          last_name,
          class_name
        )
      `)
      .eq("school_id", schoolId)
      .eq("is_deleted", false);

    // Teachers only see their assigned classes
    if (role === "teacher") {
      const assignedClasses = await getTeacherAssignedClasses(schoolId, userId);
      if (!assignedClasses.length) return res.json([]);
      query = query.in("students.class_name", assignedClasses);
    }

    if (term) query = query.eq("term", term);
    if (className) query = query.eq("class_name", className);
    if (studentId) query = query.eq("student_id", studentId);

    const { data, error } = await query.order("exam_sequence", { ascending: true });

    if (error) throw error;

    // Group results by student and subject, then calculate weighted average
    const studentSubjectMap = new Map();

    (data || []).forEach(row => {
      const studentId = row.student_id;
      const subject = row.subject;
      const key = `${studentId}-${subject}`;

      if (!studentSubjectMap.has(key)) {
        studentSubjectMap.set(key, {
          student_id: studentId,
          admission_number: row.students?.admission_number,
          first_name: row.students?.first_name,
          last_name: row.students?.last_name,
          class_name: row.class_name,
          subject: subject,
          term: row.term,
          academic_year: row.academic_year,
          exams: [],
          total_marks: 0,
          weighted_marks: 0,
          total_weight: 0
        });
      }

      const entry = studentSubjectMap.get(key);
      const weight = 1; // Default weight, can be fetched from exam_types table
      const marks = row.marks || 0;
      const total = row.total_marks || 100;

      entry.exams.push({
        exam_type: row.exam_type,
        exam_sequence: row.exam_sequence,
        exam_name: row.exam_name,
        marks: marks,
        total_marks: total,
        grade: row.grade,
        teacher_comment: row.teacher_comment
      });

      entry.total_marks += total;
      entry.weighted_marks += (marks / total) * 100 * weight;
      entry.total_weight += weight;
    });

    // Calculate final averages
    const compiledResults = Array.from(studentSubjectMap.values()).map(entry => {
      const average = entry.total_weight > 0 ? (entry.weighted_marks / entry.total_weight) : 0;
      const overallGrade = calculateGrade(average);

      return {
        ...entry,
        average_marks: Math.round(average * 100) / 100,
        overall_grade: overallGrade,
        position: null // Position can be calculated per class/subject
      };
    });

    res.json(compiledResults);
  } catch (err) {
    next(err);
  }
});

// Helper function to calculate grade from percentage
function calculateGrade(percentage) {
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  if (percentage >= 40) return "E";
  return "F";
}

export default router;
