// backend/src/routes/exams.routes.js
// Exam management routes

import express from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

// Backward-compat alias: this file uses requireAuth but middleware exports authRequired
const requireAuth = authRequired;

const router = express.Router();

const EXAM_SELECT_NEW = [
  "exam_id",
  "name",
  "exam_type",
  "term",
  "year",
  "start_date",
  "end_date",
  "description",
  "status",
  "created_at",
  "updated_at",
].join(",");

const EXAM_SELECT_OLD = [
  "exam_id",
  "exam_name",
  "term",
  "academic_year",
  "start_date",
  "end_date",
  "status",
  "created_at",
  "updated_at",
].join(",");

function isMissingColumnError(error) {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("column") ||
    text.includes("schema cache") ||
    text.includes("pgrst") ||
    text.includes("42703")
  );
}

function normalizeExam(row, schema = "new") {
  if (!row) return row;

  if (schema === "old") {
    return {
      ...row,
      name: row.exam_name,
      exam_type: row.exam_type || "internal",
      year: row.academic_year,
      description: row.description || null,
    };
  }

  return {
    ...row,
    name: row.name,
    exam_type: row.exam_type || "internal",
    year: row.year,
  };
}

function buildNewExamFilters(query, filters = {}) {
  let next = query
    .eq("is_deleted", false)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.year) next = next.eq("year", filters.year);
  if (filters.term) next = next.eq("term", filters.term);
  if (filters.status) next = next.eq("status", filters.status);

  return next;
}

function buildOldExamFilters(query, filters = {}) {
  let next = query
    .eq("is_deleted", false)
    .order("academic_year", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.year) next = next.eq("academic_year", filters.year);
  if (filters.term) next = next.eq("term", filters.term);
  if (filters.status) next = next.eq("status", filters.status);

  return next;
}

async function listExamsCompat(schoolId, filters = {}) {
  const newQuery = buildNewExamFilters(
    supabase.from("exams").select(EXAM_SELECT_NEW).eq("school_id", schoolId),
    filters
  );
  const { data, error } = await newQuery;

  if (!error) {
    return (data || []).map((row) => normalizeExam(row, "new"));
  }

  if (!isMissingColumnError(error)) throw error;

  const oldQuery = buildOldExamFilters(
    supabase.from("exams").select(EXAM_SELECT_OLD).eq("school_id", schoolId),
    filters
  );
  const { data: legacyData, error: legacyError } = await oldQuery;
  if (legacyError) throw legacyError;

  return (legacyData || []).map((row) => normalizeExam(row, "old"));
}

async function getExamCompat(schoolId, examId) {
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("exam_id", examId)
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .single();

  if (!error && data) {
    const schema = Object.prototype.hasOwnProperty.call(data, "name") ? "new" : "old";
    return normalizeExam(data, schema);
  }

  if (error && !isMissingColumnError(error)) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from("exams")
    .select(EXAM_SELECT_OLD)
    .eq("exam_id", examId)
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .single();

  if (legacyError) {
    if (legacyError.code === "PGRST116") return null;
    throw legacyError;
  }

  return normalizeExam(legacyData, "old");
}

async function insertExamCompat(schoolId, payload) {
  const newPayload = {
    school_id: schoolId,
    name: payload.name.trim(),
    exam_type: payload.examType,
    term: payload.term.trim(),
    year: Number(payload.year),
    start_date: payload.startDate,
    end_date: payload.endDate,
    description: payload.description?.trim() || null,
    status: "draft",
    is_deleted: false,
  };

  const { data, error } = await supabase
    .from("exams")
    .insert(newPayload)
    .select()
    .single();

  if (!error) {
    return normalizeExam(data, "new");
  }

  if (!isMissingColumnError(error)) throw error;

  const oldPayload = {
    school_id: schoolId,
    exam_name: payload.name.trim(),
    term: payload.term.trim(),
    academic_year: Number(payload.year),
    start_date: payload.startDate,
    end_date: payload.endDate,
    status: "draft",
    is_deleted: false,
  };

  const { data: legacyData, error: legacyError } = await supabase
    .from("exams")
    .insert(oldPayload)
    .select(EXAM_SELECT_OLD)
    .single();

  if (legacyError) throw legacyError;
  return normalizeExam(legacyData, "old");
}

async function updateExamCompat(schoolId, examId, updates) {
  const newUpdates = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) newUpdates.name = String(updates.name).trim();
  if (updates.examType !== undefined) newUpdates.exam_type = updates.examType;
  if (updates.term !== undefined) newUpdates.term = String(updates.term).trim();
  if (updates.year !== undefined) newUpdates.year = Number(updates.year);
  if (updates.startDate !== undefined) newUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) newUpdates.end_date = updates.endDate;
  if (updates.description !== undefined) newUpdates.description = updates.description?.trim() || null;
  if (updates.status !== undefined) newUpdates.status = updates.status;

  const { data, error } = await supabase
    .from("exams")
    .update(newUpdates)
    .eq("exam_id", examId)
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .select()
    .single();

  if (!error) {
    return data ? normalizeExam(data, "new") : null;
  }

  if (!isMissingColumnError(error)) throw error;

  const oldUpdates = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) oldUpdates.exam_name = String(updates.name).trim();
  if (updates.term !== undefined) oldUpdates.term = String(updates.term).trim();
  if (updates.year !== undefined) oldUpdates.academic_year = Number(updates.year);
  if (updates.startDate !== undefined) oldUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) oldUpdates.end_date = updates.endDate;
  if (updates.status !== undefined) oldUpdates.status = updates.status;

  const { data: legacyData, error: legacyError } = await supabase
    .from("exams")
    .update(oldUpdates)
    .eq("exam_id", examId)
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .select(EXAM_SELECT_OLD)
    .single();

  if (legacyError) {
    if (legacyError.code === "PGRST116") return null;
    throw legacyError;
  }

  return legacyData ? normalizeExam(legacyData, "old") : null;
}

// GET /api/exams - List all exams
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { year, term, status } = req.query;

    const exams = await listExamsCompat(schoolId, { year, term, status });
    res.json(exams);
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

    const exam = await insertExamCompat(schoolId, {
      name,
      examType,
      term,
      year,
      startDate,
      endDate,
      description,
    });

    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
});

// GET /api/exams/:id - Get exam details with schedules
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const exam = await getExamCompat(schoolId, id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const { data: schedules, error: schedError } = await supabase
      .from("exam_schedules")
      .select(`
        *,
        subject:subject_id (subject_id, name, code)
      `)
      .eq("exam_id", id)
      .eq("is_deleted", false)
      .order("exam_date", { ascending: true });

    if (schedError) throw schedError;
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

    const data = await updateExamCompat(schoolId, id, req.body || {});
    if (!data) return res.status(404).json({ message: "Exam not found" });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/exams/:id
router.delete("/:id", requireAuth, requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
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
    if (!data) return res.status(404).json({ message: "Exam not found" });

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/exams/:id/schedules - Add exam schedule
router.post("/:id/schedules", requireAuth, requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
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

    const exam = await getExamCompat(schoolId, id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const examType = exam.exam_type || "internal";

    const { data: boundaries } = await supabase
      .from("grade_boundaries")
      .select("*")
      .eq("school_id", schoolId)
      .eq("exam_type", examType)
      .eq("is_deleted", false);

    const resultsWithGrades = results.map((r) => {
      if (r.isAbsent) return { ...r, grade: "X", remarks: "Absent" };

      const percentage = Number(r.marks);
      const boundary = boundaries?.find((b) => percentage >= b.min_score && percentage <= b.max_score);

      return {
        ...r,
        grade: boundary?.grade || "F",
        remarks: getRemarks(percentage),
      };
    });

    const insertData = resultsWithGrades.map((r) => ({
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

    await calculatePositions(id, subjectId);

    res.json({ uploaded: data?.length || 0 });
  } catch (err) {
    next(err);
  }
});

// GET /api/exams/:id/results - Get results for an exam
router.get("/:id/results", requireAuth, async (req, res, next) => {
  try {
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

function getRemarks(percentage) {
  if (percentage >= 80) return "Excellent";
  if (percentage >= 70) return "Very Good";
  if (percentage >= 60) return "Good";
  if (percentage >= 50) return "Average";
  if (percentage >= 40) return "Below Average";
  return "Fail";
}

async function calculatePositions(examId, subjectId) {
  const { data: results } = await supabase
    .from("exam_results")
    .select("result_id, marks, student:class_name")
    .eq("exam_id", examId)
    .eq("subject_id", subjectId)
    .eq("is_absent", false)
    .order("marks", { ascending: false });

  if (!results) return;

  const byClass = {};
  results.forEach((r) => {
    const className = r.student?.class_name || "Unknown";
    if (!byClass[className]) byClass[className] = [];
    byClass[className].push(r);
  });

  for (const classResults of Object.values(byClass)) {
    for (let i = 0; i < classResults.length; i += 1) {
      await supabase
        .from("exam_results")
        .update({ position: i + 1 })
        .eq("result_id", classResults[i].result_id);
    }
  }
}

export default router;
