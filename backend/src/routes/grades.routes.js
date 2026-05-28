import { Router } from "express";
import multer from "multer";
import csv from "csv-parser"; 
import stream from "stream";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";
import { getTeacherAssignedClasses } from "../utils/getTeacherClasses.js";
import { uploadCsv } from "../middleware/uploadCsv.js";
import { normalizeHeader } from "../utils/normalizeCsvHeader.js";

const router = Router();
router.use(authRequired);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname?.toLowerCase().endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

function normalizeAdmissionNumber(value) {
  return String(value ?? "").trim().toLowerCase();
}

const INPUT_SPECIAL_MAP = {
  'absent': -1, 'x': -1,
  'cheat': -3, 'y': -3,
  'inc': -2, 'incomplete': -2,
  'medical': -4,
  'na': null, 'n/a': null,
};

function normaliseMarks(raw) {
  if (raw === null || raw === undefined || raw === "") return raw;
  const s = String(raw).trim().toLowerCase();
  if (s === "na" || s === "n/a") return "na";
  if (s === "absent" || s === "x") return "absent";
  if (s === "cheat" || s === "y") return "cheat";
  const n = Number(raw);
  if (!Number.isNaN(n) && n < 0) return "absent";
  return Number.isNaN(n) ? raw : n;
}

function normalise(r) {
  return {
    id: r.result_id,
    studentId: r.student_id,
    studentName: r.student_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    className: r.class_name ?? "",
    subject: r.subject_name ?? r.subject ?? "",
    term: r.term ?? "Term 2",
    marks: normaliseMarks(r.marks),
    total: Number(r.total_marks ?? 100),
    grade: r.grade ?? "",
    teacherComment: r.teacher_comment ?? "",
  };
}

// ─── GET /api/grades — list all ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role, userId } = req.user;
    const { studentId, term, classId } = req.query;

    let query = supabase
      .from("results")
      .select("result_id,student_id,class_id,marks,total_marks,grade,teacher_comment,term,subject,school_id,is_deleted")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("result_id", { ascending: false });

    if (role === 'teacher') {
      const assignedClasses = await getTeacherAssignedClasses(schoolId, userId);
      if (assignedClasses.length === 0) return res.json([]);
      query = query.in('class_name', assignedClasses);
    }

    if (studentId) query = query.eq("student_id", studentId);
    if (term) query = query.eq("term", term);
    if (classId) query = query.eq("class_id", classId);

    const { data: resultRows, error: resultsErr } = await query;
    if (resultsErr) throw resultsErr;

    const studentIds = [...new Set((resultRows || []).map(r => r.student_id).filter(Boolean))];

    const { data: studentRows } = studentIds.length 
      ? await supabase.from("students").select("student_id,first_name,last_name,class_name")
          .eq("school_id", schoolId).eq("is_deleted", false).in("student_id", studentIds)
      : { data: [] };

    const studentById = new Map((studentRows || []).map(s => [s.student_id, s]));

    const merged = (resultRows || []).map(r => ({
      ...r,
      first_name: studentById.get(r.student_id)?.first_name,
      last_name: studentById.get(r.student_id)?.last_name,
      class_name: studentById.get(r.student_id)?.class_name,
    }));

    res.json(merged.map(normalise));
  } catch (err) { next(err); }
});

// ─── POST /api/grades/import — Simple CSV Import (per subject row) ───────────
router.post(
  '/import',
  requireRoles('admin', 'teacher', 'director'),
  uploadCsv.single('file'),
  async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;

      if (!req.file) {
        return res.status(400).json({ message: 'CSV file is required' });
      }

      const rows = [];
      const bufferStream = new stream.PassThrough();

      bufferStream.end(
        req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '')
      );

      bufferStream
        .pipe(csv({
          mapHeaders: ({ header }) => normalizeHeader(header),
          trim: true
        }))
        .on('data', (row) => {
          if (Object.values(row).some(v => String(v).trim())) {
            rows.push(row);
          }
        })
        .on('end', async () => {
          if (rows.length === 0) {
            return res.status(400).json({ message: 'CSV file contains no data' });
          }

          let successCount = 0;
          let skipped = 0;
          const errors = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 2;

            try {
              const admission = row.admission_number?.toString().trim();
              const subject = row.subject?.toString().trim();

              if (!admission) {
                skipped++;
                errors.push({ row: rowNumber, error: 'Missing admission_number' });
                continue;
              }
              if (!subject) {
                skipped++;
                errors.push({ row: rowNumber, admission, error: 'Missing subject' });
                continue;
              }

              const { data: student, error: studentError } = await supabase
                .from('students')
                .select('student_id, class_name')
                .eq('school_id', schoolId)
                .ilike('admission_number', admission)
                .eq('is_deleted', false)
                .single();

              if (studentError || !student) {
                skipped++;
                errors.push({ row: rowNumber, admission, error: 'Student not found' });
                continue;
              }

              const marks = parseFloat(row.marks);
              if (isNaN(marks) && String(row.marks || '').trim() !== '') {
                skipped++;
                errors.push({ row: rowNumber, admission, subject, error: 'Invalid marks value' });
                continue;
              }

              if (isNaN(marks) || String(row.marks || '').trim() === '') {
                skipped++;
                continue;
              }

              const { error: upsertError } = await supabase
                .from('results')
                .upsert({
                  school_id: schoolId,
                  student_id: student.student_id,
                  subject: subject,
                  marks: marks,
                  total_marks: parseFloat(row.total_marks) || 100,
                  grade: row.grade?.trim() || null,
                  teacher_comment: row.teacher_comment?.trim() || null,
                  term: row.term?.trim() || 'Term 2',
                  exam_type: row.exam_type?.trim() || 'Mid-Term',
                  class_name: row.class_name?.trim() || student.class_name,
                  entered_by: userId,
                  is_deleted: false
                }, {
                  onConflict: 'school_id,student_id,subject,term'
                });

              if (upsertError) throw upsertError;

              successCount++;
            } catch (err) {
              skipped++;
              errors.push({
                row: rowNumber,
                admission: row.admission_number,
                subject: row.subject,
                error: err.message
              });
            }
          }

          res.json({
            success: true,
            message: `Import completed: ${successCount} imported, ${skipped} skipped`,
            imported: successCount,
            skipped,
            errors: errors.length ? errors : undefined
          });
        })
        .on('error', (err) => next(err));
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /:id ───────────────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: result, error } = await supabase
      .from('results')
      .select('result_id, student_id, marks, total_marks, grade, teacher_comment, term, subject, students(first_name, last_name, class_name)')
      .eq('result_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (error || !result) return res.status(404).json({ message: "Result not found" });

    const row = {
      ...result,
      first_name: result.students?.first_name,
      last_name: result.students?.last_name,
      class_name: result.students?.class_name,
      students: undefined
    };

    res.json(normalise(row));
  } catch (err) { next(err); }
});

export default router;