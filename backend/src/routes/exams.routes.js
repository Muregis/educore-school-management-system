// backend/src/routes/exams.routes.js
// Exam management routes

import express from "express";
const router = express.Router();
import { supabase } from "../config/supabaseClient.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

// GET /api/exams - List all exams
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { year, term, status } = req.query;

    let query = supabase
      .from("exams")
      .select("exam_id, name, exam_type, term, year, start_date, end_date, description, status, created_at")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("year", { ascending: false })
      .order("created_at", { ascending: false });

    if (year) query = query.eq("year", year);
    if (term) query = query.eq("term", term);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// POST /api/exams - Create new exam
router.post("/", requireAuth, requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, examType = "internal", term, year, startDate, endDate, description } = req.body;

    if (!name || !term || !year || !startDate || !endDate) {
      return res.status(400).json({ message: "name, term, year, startDate, endDate are required" });
    }

    const { data, error } = await supabase
      .from("exams")
      .insert({
        school_id: schoolId,
        name: name.trim(),
        exam_type: examType,
        term: term.trim(),
        year: Number(year),
        start_date: startDate,
        end_date: endDate,
        description: description?.trim() || null,
        status: "draft",
        is_deleted: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/exams/:id - Get exam details with schedules
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("*")
      .eq("exam_id", id)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .single();

    if (examError || !exam) return res.status(404).json({ message: "Exam not found" });

    // Get schedules
    const { data: schedules, error: schedError } = await supabase
      .from("exam_schedules")
      .select(`
        *,
        subject:subject_id (subject_id, name, code)
      `)
      .eq("exam_id", id)
      .eq("is_deleted", false)
      .order("exam_date", { ascending: true });

    res.json({ ...exam, schedules: schedules || [] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/exams/:id - Update exam
router.put("/:id", requireAuth, requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from("exams")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("exam_id", id)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Exam not found" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/exams/:id
router.delete("/:id", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("exams")
      .update({ is_deleted: true })
      .eq("exam_id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/exams/:id/schedules - Add exam schedule
router.post("/:id/schedules", requireAuth, requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { subjectId, className, examDate, startTime, endTime, venue, maxMarks = 100, instructions } = req.body;

    if (!subjectId || !className || !examDate) {
      return res.status(400).json({ message: "subjectId, className, examDate are required" });
    }

    const { data, error } = await supabase
      .from("exam_schedules")
      .insert({
        exam_id: id,
        subject_id: subjectId,
        class_name: className,
        exam_date: examDate,
        start_time: startTime || null,
        end_time: endTime || null,
        venue: venue?.trim() || null,
        max_marks: maxMarks,
        instructions: instructions?.trim() || null,
        is_deleted: false,
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes("unique")) {
        return res.status(409).json({ message: "Schedule already exists for this subject and class" });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/exams/:id/results/bulk - Bulk upload results
router.post("/:id/results/bulk", requireAuth, requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { id } = req.params;
    const { subjectId, results } = req.body; // results = [{ studentId, marks, isAbsent }]

    if (!subjectId || !results || !Array.isArray(results)) {
      return res.status(400).json({ message: "subjectId and results array are required" });
    }

    // Get grade boundaries
    const { data: boundaries } = await supabase
      .from("grade_boundaries")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_deleted", false);

    // Calculate grades
    const resultsWithGrades = results.map(r => {
      if (r.isAbsent) return { ...r, grade: "X", remarks: "Absent" };
      
      const percentage = (r.marks / 100) * 100;
      const boundary = boundaries?.find(b => percentage >= b.min_score && percentage <= b.max_score);
      
      return {
        ...r,
        grade: boundary?.grade || "F",
        remarks: getRemarks(percentage),
      };
    });

    // Insert results
    const insertData = resultsWithGrades.map(r => ({
      exam_id: id,
      student_id: r.studentId,
      subject_id: subjectId,
      marks: r.isAbsent ? null : r.marks,
      grade: r.grade,
      remarks: r.remarks,
      is_absent: r.isAbsent || false,
      entered_by: userId,
      entered_at: new Date().toISOString(),
      is_deleted: false,
    }));

    const { data, error } = await supabase
      .from("exam_results")
      .upsert(insertData, { onConflict: "exam_id,student_id,subject_id" })
      .select();

    if (error) throw error;

    // Calculate and update positions
    await calculatePositions(id, subjectId);

    res.json({ uploaded: data?.length || 0 });
  } catch (err) {
    next(err);
  }
});

// GET /api/exams/:id/results - Get results for an exam
router.get("/:id/results", requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { subjectId, className } = req.query;

    let query = supabase
      .from("exam_results")
      .select(`
        *,
        student:student_id (student_id, admission_number, first_name, last_name, class_name),
        subject:subject_id (name, code)
      `)
      .eq("exam_id", id)
      .eq("is_deleted", false);

    if (subjectId) query = query.eq("subject_id", subjectId);
    if (className) query = query.eq("student.class_name", className);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// Helper functions
function getRemarks(percentage) {
  if (percentage >= 80) return "Excellent";
  if (percentage >= 70) return "Very Good";
  if (percentage >= 60) return "Good";
  if (percentage >= 50) return "Average";
  if (percentage >= 40) return "Below Average";
  return "Fail";
}

async function calculatePositions(examId, subjectId) {
  // Calculate class positions for each subject
  const { data: results } = await supabase
    .from("exam_results")
    .select("result_id, marks, student:class_name")
    .eq("exam_id", examId)
    .eq("subject_id", subjectId)
    .eq("is_absent", false)
    .order("marks", { ascending: false });

  if (!results) return;

  // Group by class and assign positions
  const byClass = {};
  results.forEach(r => {
    const className = r.student?.class_name || "Unknown";
    if (!byClass[className]) byClass[className] = [];
    byClass[className].push(r);
  });

  for (const [className, classResults] of Object.entries(byClass)) {
    for (let i = 0; i < classResults.length; i++) {
      await supabase
        .from("exam_results")
        .update({ position: i + 1 })
        .eq("result_id", classResults[i].result_id);
    }
  }
}

export default router;
