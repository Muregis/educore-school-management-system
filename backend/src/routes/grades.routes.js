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
import { knecGrade } from "../utils/knecGrading.js";

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

function normalizeGender(value) {
  if (!value || value === "" || value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (s === 'm' || s === 'male') return 'male';
  if (s === 'f' || s === 'female') return 'female';
  if (s === 'o' || s === 'other') return 'other';
  // If it's already a valid value, return it
  if (['male', 'female', 'other'].includes(s)) return s;
  // Default to null for unrecognized values
  return null;
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

function getExamSequence(examType) {
  const type = String(examType || "").toLowerCase();
  if (type.includes("opener") || type.includes("cat1")) return 1;
  if (type.includes("mid") || type.includes("cat2")) return 2;
  if (type.includes("end") || type.includes("final")) return 3;
  return 2; // Default to Mid-Term sequence
}

function normalise(r) {
  return {
    id: r.result_id,
    studentId: r.student_id,
    studentName: r.student_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    className: r.class_name ?? "",
    subject: r.subject_name ?? r.subject ?? "",
    term: r.term ?? "Term 2",
    examType: r.exam_type ?? "Mid-Term",
    marks: normaliseMarks(r.marks),
    total: Number(r.total_marks ?? 100),
    grade: r.grade ?? "",
    teacherComment: r.teacher_comment ?? "",
  };
}

const IMPORT_METADATA_COLUMNS = new Set([
  'student_name',
  'admission_number',
  'term',
  'exam_type',
  'class_name',
  'subject',
  'marks',
  'total_marks',
  'grade',
  'teacher_comment',
]);

function displaySubjectFromHeader(header) {
  return String(header || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

function expandImportRows(rows, fallbackExamType) {
  const expanded = [];

  for (const row of rows) {
    if (row.subject || row.marks !== undefined) {
      expanded.push({ ...row, exam_type: row.exam_type || fallbackExamType });
      continue;
    }

    const subjectKeys = Object.keys(row).filter(key =>
      !IMPORT_METADATA_COLUMNS.has(key) && String(row[key] ?? '').trim() !== ''
    );

    for (const key of subjectKeys) {
      expanded.push({
        admission_number: row.admission_number,
        subject: displaySubjectFromHeader(key),
        marks: row[key],
        total_marks: row.total_marks || 100,
        term: row.term,
        exam_type: row.exam_type || fallbackExamType,
        class_name: row.class_name,
      });
    }
  }

  return expanded;
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
router.get('/template', requireRoles('admin', 'teacher', 'director', 'superadmin'), (_req, res) => {
  const csvTemplate = [
    'admission_number,subject,marks,total_marks,term,exam_type,class_name',
    'RPP-001,Mathematics,78,100,Term 2,Mid-Term,Grade 5',
    'RPP-001,English,85,100,Term 2,Mid-Term,Grade 5',
    'RPP-002,Mathematics,62,100,Term 2,Mid-Term,Grade 5',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="grades_import_template.csv"');
  res.send(csvTemplate);
});

router.post(
  '/import',
  requireRoles('admin', 'teacher', 'director'),
  uploadCsv.single('file'),
  async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const fallbackExamType = String(req.query.examType || req.body?.examType || 'Mid-Term').trim() || 'Mid-Term';

      if (!req.file) {
        return res.status(400).json({ message: 'CSV file is required' });
      }

      const rows = [];
      const bufferStream = new stream.PassThrough();

      bufferStream.end(
        req.file.buffer
          .toString('utf-8')
          .replace(/^\uFEFF/, '')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
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
          try {
            const allRows = expandImportRows(rows, fallbackExamType);

            if (allRows.length === 0) {
              return res.status(400).json({ message: 'CSV file contains no data' });
            }

            // Phase 1: Collect all unique admission numbers
            const admissionNumbers = [...new Set(allRows.map(r => r.admission_number?.toString().trim()).filter(Boolean))];
            
            // Phase 2: Batch fetch all students in one query
            const { data: students, error: studentsError } = await supabase
              .from('students')
              .select('student_id, admission_number, class_name, first_name, last_name')
              .eq('school_id', schoolId)
              .eq('is_deleted', false)
              .in('admission_number', admissionNumbers);

            if (studentsError) {
              console.error('Error fetching students:', studentsError);
              return res.status(500).json({ message: 'Failed to fetch student data', error: studentsError.message });
            }

            // Create a map for quick lookup
            const studentMap = new Map();
            (students || []).forEach(s => {
              studentMap.set(s.admission_number.toLowerCase().trim(), s);
            });

            // Phase 3: Process rows and prepare batch inserts
            const resultsToInsert = [];
            const errors = [];
            let skipped = 0;

            for (let i = 0; i < allRows.length; i++) {
              const row = allRows[i];
              const rowNumber = i + 2;

              try {
                const admission = row.admission_number?.toString().trim();
                const subject = row.subject?.toString().trim();

                if (!admission) {
                  skipped++;
                  errors.push({ row: rowNumber, reason: 'Missing admission_number' });
                  continue;
                }
                if (!subject) {
                  skipped++;
                  errors.push({ row: rowNumber, admission, reason: 'Missing subject' });
                  continue;
                }

                const student = studentMap.get(admission.toLowerCase());
                if (!student) {
                  skipped++;
                  errors.push({ row: rowNumber, admission, reason: `Student not found: ${admission}` });
                  continue;
                }

                // Handle marks - be more permissive
                let marks = row.marks;
                
                // If marks is empty, skip the row
                if (marks === null || marks === undefined || String(marks).trim() === '') {
                  skipped++;
                  continue;
                }
                
                // Try to convert to number
                const numMarks = Number(marks);
                if (!isNaN(numMarks)) {
                  marks = numMarks;
                } else {
                  // If not a number, check for special values
                  const s = String(marks).trim().toLowerCase();
                  if (s === 'absent' || s === 'x' || s === '-') {
                    marks = 0; // Treat absent as 0 for now
                  } else if (s === 'na' || s === 'n/a') {
                    skipped++;
                    continue; // Skip NA values
                  } else {
                    // Try to extract number from string (e.g., "80/100" -> 80)
                    const match = s.match(/(\d+)/);
                    if (match) {
                      marks = Number(match[1]);
                    } else {
                      skipped++;
                      errors.push({ row: rowNumber, admission, subject, reason: `Invalid marks value: ${row.marks}` });
                      continue;
                    }
                  }
                }

                const totalMarks = parseFloat(row.total_marks) || 100;
                const percentage = totalMarks > 0 ? (marks / totalMarks) * 100 : 0;
                const calculatedGrade = knecGrade(percentage);

                resultsToInsert.push({
                  school_id: schoolId,
                  student_id: student.student_id,
                  subject: subject,
                  marks: marks,
                  total_marks: totalMarks,
                  grade: calculatedGrade.level, // Store EE, ME, AE, BE
                  teacher_comment: row.teacher_comment?.trim() || null,
                  term: row.term?.trim() || 'Term 2',
                  exam_type: row.exam_type?.trim() || fallbackExamType,
                  is_deleted: false
                });
              } catch (err) {
                skipped++;
                errors.push({
                  row: rowNumber,
                  admission: row.admission_number,
                  subject: row.subject,
                  reason: err.message
                });
              }
            }

            // Phase 4: Batch insert all results
            let successCount = 0;
            if (resultsToInsert.length > 0) {
              // Insert in batches of 100 to avoid payload size limits
              const batchSize = 100;
              for (let i = 0; i < resultsToInsert.length; i += batchSize) {
                const batch = resultsToInsert.slice(i, i + batchSize);
                const { error: insertError } = await supabase
                  .from('results')
                  .upsert(batch, {
                    onConflict: 'school_id,student_id,subject,term,exam_type',
                    ignoreDuplicates: false
                  });

                if (insertError) {
                  console.error('Batch insert error:', insertError);
                  // If batch fails, try individual inserts for this batch
                  for (const record of batch) {
                    try {
                      const { error: singleError } = await supabase
                        .from('results')
                        .upsert(record, {
                          onConflict: 'school_id,student_id,subject,term,exam_type'
                        });
                      if (!singleError) successCount++;
                      else errors.push({ reason: singleError.message, record });
                    } catch (e) {
                      errors.push({ reason: e.message, record });
                    }
                  }
                } else {
                  successCount += batch.length;
                }
              }
            }

            res.json({
              success: true,
              message: `Imported ${successCount} results. ${skipped} rows had errors.`,
              imported: successCount,
              skipped,
              total: allRows.length,
              errors: errors.length > 100 ? errors.slice(0, 100).concat({ message: `... and ${errors.length - 100} more errors` }) : errors
            });
          } catch (err) {
            console.error('Import processing error:', err);
            next(err);
          }
        })
        .on('error', (err) => {
          console.error('CSV parsing error:', err);
          next(err);
        });
    } catch (err) {
      console.error('Import endpoint error:', err);
      next(err);
    }
  }
);

// ─── POST /api/grades/recalculate — Recalculate grades for existing results ───
router.post('/recalculate', requireRoles('admin', 'director', 'superadmin'), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term, classId, studentId } = req.query;

    let query = supabase
      .from('results')
      .select('result_id, marks, total_marks')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (term) query = query.eq('term', term);
    if (classId) query = query.eq('class_id', classId);
    if (studentId) query = query.eq('student_id', studentId);

    const { data: results, error } = await query;
    if (error) throw error;

    let updated = 0;
    for (const result of results || []) {
      const totalMarks = result.total_marks || 100;
      const percentage = totalMarks > 0 ? (result.marks / totalMarks) * 100 : 0;
      const calculatedGrade = knecGrade(percentage);

      const { error: updateError } = await supabase
        .from('results')
        .update({ grade: calculatedGrade.level })
        .eq('result_id', result.result_id);

      if (!updateError) updated++;
    }

    res.json({
      success: true,
      message: `Recalculated grades for ${updated} results`,
      updated
    });
  } catch (err) {
    next(err);
  }
});

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

// ─── PUT /:id ───────────────────────────────────────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { subject, term, examType, marks, totalMarks, teacherComment } = req.body;

    // Calculate grade from marks
    const total = Number(totalMarks) || 100;
    const percentage = total > 0 ? (Number(marks) / total) * 100 : 0;
    const calculatedGrade = knecGrade(percentage);

    const { data: result, error: fetchError } = await supabase
      .from('results')
      .select('result_id')
      .eq('result_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !result) return res.status(404).json({ message: "Result not found" });

    const { error: updateError } = await supabase
      .from('results')
      .update({
        subject: subject,
        term: term,
        exam_type: examType,
        marks: marks,
        total_marks: total,
        grade: calculatedGrade.level,
        teacher_comment: teacherComment || null,
        updated_at: new Date().toISOString()
      })
      .eq('result_id', req.params.id)
      .eq('school_id', schoolId);

    if (updateError) throw updateError;

    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE /:id ───────────────────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: result, error: fetchError } = await supabase
      .from('results')
      .select('result_id')
      .eq('result_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !result) return res.status(404).json({ message: "Result not found" });

    const { error: deleteError } = await supabase
      .from('results')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('result_id', req.params.id)
      .eq('school_id', schoolId);

    if (deleteError) throw deleteError;

    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
