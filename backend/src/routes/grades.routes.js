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

// Map common frontend special mark codes to numeric sentinels or null
const INPUT_SPECIAL_MAP = {
  'absent': -1,
  'x': -1,
  'cheat': -3,
  'y': -3,
  'inc': -2,
  'incomplete': -2,
  'medical': -4,
  'na': null,
  'n/a': null,
};

// ─── Helper: validate teacher class access for grades ─────────────────────
async function validateTeacherGradeAccess(schoolId, userId, classId) {
  if (!classId) return true; // No class filter, allow access
  
  const { data: teacherClasses, error } = await supabase
    .from("teacher_classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("teacher_id", userId)
    .eq("is_deleted", false);
  if (error) throw error;
  
  const teacherClassIds = teacherClasses?.map(tc => tc.class_id).filter(Boolean) || [];
  if (!teacherClassIds.includes(Number(classId))) {
    throw new Error("Teacher can only access grades for their assigned classes");
  }
  return true;
}

function normaliseMarks(raw) {
  if (raw === null || raw === undefined || raw === "") return raw;
  const s = String(raw).trim().toLowerCase();
  if (s === "na" || s === "n/a") return "na";
  if (s === "absent" || s === "x") return "absent";
  if (s === "cheat" || s === "y") return "cheat";
  const n = Number(raw);
  if (!Number.isNaN(n) && n < 0) {
    if (n === -1) return "absent";
    if (n === -3) return "cheat";
    return "absent";
  }
  return Number.isNaN(n) ? raw : n;
}

// ─── Helper: map DB result row → camelCase shape frontend expects ─────────
function normalise(r) {
  return {
    id:             r.result_id,
    studentId:      r.student_id,
    studentName:    r.student_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    className:      r.class_name  ?? "",
    subject:        r.subject_name ?? r.subject ?? "",
    term:           r.term        ?? "Term 2",
    marks:          normaliseMarks(r.marks),
    total:          Number(r.total_marks ?? 100),
    grade:          r.grade       ?? "",
    teacherComment: r.teacher_comment ?? "",
  };
}

// ─── GET /api/grades — list all results for school ───────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role, userId } = req.user;
    const { studentId, term, classId } = req.query;
    if (role === 'teacher') {
  const assignedClasses =
    await getTeacherAssignedClasses(schoolId, userId);

  if (assignedClasses.length === 0) {
    return res.json([]);
  }

  query = query.in('class_name', assignedClasses);
}

    // Validate teacher class access
    if (role === "teacher") {
      await validateTeacherGradeAccess(schoolId, userId, classId);
    }

    let q = supabase
      .from("results")
      .select("result_id,student_id,class_id,marks,total_marks,grade,teacher_comment,term,subject,school_id,is_deleted")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("result_id", { ascending: false });

    if (studentId) q = q.eq("student_id", studentId);
    if (term) q = q.eq("term", term);
    if (classId) q = q.eq("class_id", classId);

    const { data: resultRows, error: resultsErr } = await q;
    if (resultsErr) throw resultsErr;

    const studentIds = [...new Set((resultRows || []).map(r => r.student_id).filter(Boolean))];
    const { data: studentRows, error: studentsErr } = studentIds.length
      ? await supabase
          .from("students")
          .select("student_id,first_name,last_name,class_name,school_id,is_deleted")
          .eq("school_id", schoolId)
          .eq("is_deleted", false)
          .in("student_id", studentIds)
      : { data: [], error: null };
    if (studentsErr) throw studentsErr;

    const studentById = new Map((studentRows || []).map(s => [s.student_id, s]));
    const merged = (resultRows || []).map(r => {
      const s = studentById.get(r.student_id) || {};
      return {
        ...r,
        first_name: s.first_name,
        last_name: s.last_name,
        class_name: s.class_name,
      };
    });

    res.json(merged.map(normalise));
} catch (err) { next(err); }
});

// ─── POST /api/grades/import — bulk import grades from CSV file ───────────────
// CSV format: Student Name, Admission Number, Subject1, Subject2, ..., Term
router.post("/import", requireRoles("admin", "teacher"), csvUpload.single("file"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    if (!req.file) return res.status(400).json({ message: "No CSV file uploaded" });

    console.log("[grades/import] File received:", req.file.originalname, `(${req.file.size} bytes)`);

    const csvText = req.file.buffer.toString("utf-8").replace(/^\uFEFF/, "");


    let records;
    try {
      records = parseCsv(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
      console.log("[grades/import] csv-parse succeeded:", records.length, "record(s)");
      if (records.length > 0) {
        console.log("[grades/import] First row keys:", Object.keys(records[0]));
        console.log("[grades/import] First row values:", JSON.stringify(records[0]).slice(0, 500));
      }
    } catch (parseErr) {
      console.error("[grades/import] csv-parse error:", parseErr.message);
      console.error("[grades/import] Raw CSV text (first 500 chars):", csvText.slice(0, 500));
      return res.status(400).json({ message: `Invalid CSV format: ${parseErr.message}` });
    }

    if (!records.length) {
      return res.status(400).json({ message: "CSV file is empty or has no data rows" });
    }

    const headerKeys = Object.keys(records[0]).filter(k => k.trim() !== "");
    const findCol = (...needles) =>
      headerKeys.find(h => needles.some(n => h.toLowerCase().includes(n)));

    // Prioritize "student name" before falling back to generic "name" to avoid
    // matching unintended columns like "Admission Name" or "Class Name"
    const nameCol = findCol("student name") || findCol("name");
    const admCol = findCol("admission", "adm no", "adm", "reg no", "reg");
    const termCol = findCol("term");

    console.log("[grades/import] Column detection:", { nameCol, admCol, termCol, headerKeys });

    if (!admCol) {
      return res.status(400).json({
        message: `Admission Number column not found. Found columns: ${headerKeys.join(", ")}. Use a column named 'Admission Number'.`,
      });
    }

    const subjectColumns = headerKeys.filter(
      h => h !== nameCol && h !== admCol && h !== termCol
    );

    if (subjectColumns.length === 0) {
      return res.status(400).json({ message: "No subject columns found in CSV header" });
    }

    console.log("[grades/import] Subject columns:", subjectColumns);

    const defaultTerm = (termCol && records[0][termCol]?.trim()) || "Term 1";

    const rows = records.map(record => {
      const rowTerm = (termCol && record[termCol]?.trim()) || defaultTerm;
      return {
        admissionNumber: record[admCol] || "",
        studentName: nameCol ? (record[nameCol] || "") : "",
        term: rowTerm,
        marks: subjectColumns.reduce((acc, col) => {
          acc[col] = record[col] ?? "";
          return acc;
        }, {}),
      };
    });

    console.log("[grades/import] Rows prepared:", rows.length, "unique admissions:", [...new Set(rows.map(r => normalizeAdmissionNumber(r.admissionNumber)).filter(Boolean))].length);

    const uniqueAdmNos = [...new Set(
      rows.map(r => normalizeAdmissionNumber(r.admissionNumber)).filter(Boolean)
    )];
    const studentMap = {};

    if (uniqueAdmNos.length > 0) {
      const { data: studentRows, error: studentsErr } = await supabase
        .from("students")
        .select("student_id, admission_number, first_name, last_name, class_id, class_name")
        .eq("school_id", schoolId)
        .eq("is_deleted", false);

      if (studentsErr) throw studentsErr;

      for (const s of (studentRows || [])) {
        const key = normalizeAdmissionNumber(s.admission_number);
        if (key && uniqueAdmNos.includes(key)) {
          studentMap[key] = s;
        }
      }

      const matched = Object.keys(studentMap).length;
      console.log("[grades/import] Student lookup:", matched, "matched out of", uniqueAdmNos.length, "unique admission numbers");
      if (matched < uniqueAdmNos.length) {
        const unmatched = uniqueAdmNos.filter(k => !studentMap[k]);
        console.log("[grades/import] Unmatched admission numbers:", unmatched);
      }
    }

    if (Object.keys(studentMap).length === 0 && uniqueAdmNos.length > 0) {
      return res.status(400).json({
        message: `No students found matching the ${uniqueAdmNos.length} admission number(s) in the CSV. Check that admission numbers are correct and students exist in the system.`,
      });
    }

    const calcGrade = (marks, total) => {
      const pct = (Number(marks) / Number(total || 1)) * 100;
      if (pct >= 80) return "EE";
      if (pct >= 65) return "ME";
      if (pct >= 50) return "AE";
      return "BE";
    };

    let imported = 0;
    let skipped = 0;
    let notFound = 0;

    for (const row of rows) {
      const admKey = normalizeAdmissionNumber(row.admissionNumber);
      if (!admKey) {
        notFound++;
        skipped++;
        continue;
      }
      const student = studentMap[admKey];

      if (!student) {
        notFound++;
        skipped++;
        continue;
      }

      const resolvedClassId = student.class_id || null;

      let resolvedExamId;
      if (row.term) {
        const { data: exam, error: examError } = await supabase
          .from("exams")
          .select("exam_id")
          .eq("school_id", schoolId)
          .eq("term", row.term)
          .eq("is_deleted", false)
          .single();
        if (!examError && exam) {
          resolvedExamId = exam.exam_id;
        } else {
          const currentYear = new Date().getFullYear();
          const { data: inserted, error: insertError } = await supabase
            .from("exams")
            .insert({
              school_id: schoolId,
              exam_name: `${row.term} Exam`,
              term: row.term,
              academic_year: currentYear,
              status: "published",
            })
            .select("exam_id")
            .single();
          if (!insertError && inserted) resolvedExamId = inserted.exam_id;
        }
      }

      const studentId = student.student_id;
      const totalMarks = 100;

      const subjectsRow = {};
      for (const sub of subjectColumns) {
        const raw = row.marks[sub] ?? "";
        const key = String(raw).trim().toLowerCase();

        if (!raw) {
          subjectsRow[sub] = null;
          continue;
        }

        const parsed = INPUT_SPECIAL_MAP[key];
        if (parsed === null) {
          subjectsRow[sub] = null;
          continue;
        }
        if (typeof parsed === "number" && parsed < 0) {
          subjectsRow[sub] = { marksValue: parsed, grade: "X" };
          continue;
        }
        const num = Number(raw);
        if (Number.isNaN(num)) {
          subjectsRow[sub] = null;
          continue;
        }
        subjectsRow[sub] = { marksValue: num, grade: calcGrade(num, totalMarks) };
      }

      const { data: existingResults, error: existingErr } = await supabase
        .from("results")
        .select("subject")
        .eq("school_id", schoolId)
        .eq("student_id", studentId)
        .eq("term", row.term)
        .eq("is_deleted", false);

      if (!existingErr && existingResults) {
        const currentSubjects = new Set(subjectColumns);
        for (const er of existingResults) {
          if (!currentSubjects.has(er.subject)) {
            await supabase
              .from("results")
              .update({ marks: null, grade: null, updated_at: new Date().toISOString() })
              .eq("school_id", schoolId)
              .eq("student_id", studentId)
              .eq("subject", er.subject)
              .eq("term", row.term)
              .eq("is_deleted", false);
          }
        }
      }

      for (const subject of subjectColumns) {
        const entry = subjectsRow[subject];
        if (entry === null) continue;

        const { marksValue, grade } = entry;

        const { data: subjectRow, error: subjErr } = await supabase
          .from("subjects")
          .select("subject_id")
          .eq("school_id", schoolId)
          .eq("subject_name", subject)
          .eq("is_deleted", false)
          .single();
        if (!subjErr && subjectRow) {
          // subject exists
        } else {
          const code = subject.substring(0, 10).toUpperCase().replace(/\s+/g, "_");
          const { error: insErr } = await supabase
            .from("subjects")
            .upsert({
              school_id: schoolId,
              subject_name: subject,
              name: subject,
              code,
            }, { onConflict: "school_id,code" });
          if (insErr) throw insErr;
        }

        const finalGrade = marksValue < 0 ? "X" : grade;

        let upsertErr = null;
        let finalResultId = null;

        const { data: existing, error: findErr } = await supabase
          .from("results")
          .select("result_id")
          .eq("school_id", schoolId)
          .eq("student_id", studentId)
          .eq("subject", subject)
          .eq("term", row.term)
          .eq("is_deleted", false)
          .maybeSingle();

        if (findErr) {
          upsertErr = findErr;
        } else if (existing) {
          const { data: updated, error: updateErr } = await supabase
            .from("results")
            .update({
              marks: Number(marksValue),
              total_marks: totalMarks,
              grade: finalGrade,
              class_id: resolvedClassId,
              exam_id: resolvedExamId || null,
              updated_at: new Date().toISOString(),
            })
            .eq("result_id", existing.result_id)
            .select("result_id")
            .single();
          if (updateErr) upsertErr = updateErr;
          else if (updated) finalResultId = updated.result_id;
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from("results")
            .insert({
              school_id: schoolId,
              student_id: studentId,
              subject,
              class_id: resolvedClassId,
              marks: Number(marksValue),
              total_marks: totalMarks,
              grade: finalGrade,
              term: row.term,
              exam_id: resolvedExamId || null,
            })
            .select("result_id")
            .single();
          if (insertErr) upsertErr = insertErr;
          else if (inserted) finalResultId = inserted.result_id;
        }

        if (upsertErr) {
          console.error("Upsert error for", studentId, subject, upsertErr.message);
          skipped++;
          continue;
        }

        imported++;

        await logAuditEvent(req, AUDIT_ACTIONS.GRADE_CREATE, {
          entityId: studentId,
          entityType: "result",
          description: `Grade imported via CSV for student ${studentId} (${student.admission_number}) in ${subject}: ${marksValue}/${totalMarks} (${finalGrade})`,
          newValues: { studentId, subject, marks: marksValue, totalMarks, grade: finalGrade, term: row.term },
        });
      }
    }

    res.status(201).json({
      message: "CSV import complete",
      imported,
      skipped,
      notFound,
      rowsProcessed: rows.length,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/grades/:id — single result ─────────────────────────────────────
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
    // Flatten joined data
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

// ─── POST /api/grades/import — CSV Import (using csv-parser) ─────────────────
router.post(
  '/import',
  authRequired,
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
    // Resolve or create a default exam for the term if not provided
    let resolvedExamId = examId;
    if (!resolvedExamId) {
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('exam_id')
        .eq('school_id', schoolId)
        .eq('term', term)
        .eq('is_deleted', false)
        .single();
      if (!examError && exam) {
        resolvedExamId = exam.exam_id;
      } else {
        const currentYear = new Date().getFullYear();
        const { data: inserted, error: insertError } = await supabase
          .from('exams')
          .insert({
            school_id: schoolId,
            exam_name: `${term} Exam`,
            term,
            academic_year: currentYear,
            status: 'published'
          })
          .select('exam_id')
          .single();
        if (insertError) throw insertError;
        resolvedExamId = inserted.exam_id;
      }
    }

    const calcGrade = (marks, total) => {
      const pct = (Number(marks) / Number(total || 1)) * 100;
    if (pct >= 80) return "EE";
    if (pct >= 65) return "ME";
    if (pct >= 50) return "AE";
    return "BE";
    };

    const saved = [];
    for (const entry of subjects) {
        const { subject, marks } = entry;
        if (!subject || marks === undefined || marks === null || marks === "") continue;

        // Normalize special mark inputs from the frontend (strings like 'absent', 'cheat', 'na')
        let marksValue = marks;
        if (typeof marks === 'string') {
          const key = marks.trim().toLowerCase();
          if (Object.prototype.hasOwnProperty.call(INPUT_SPECIAL_MAP, key)) {
            marksValue = INPUT_SPECIAL_MAP[key];
          } else {
            marksValue = Number(marks);
          }
        } else {
          marksValue = Number(marks);
        }

        // If marksValue is explicitly null (N/A / not assessed), skip saving this subject
        if (marksValue === null) continue;

      // Resolve subject_id — find or create the subject
        let { data: subjectRow, error: subjectError } = await supabase
          .from('subjects')
          .select('subject_id')
          .eq('school_id', schoolId)
          .eq('subject_name', subject)
          .eq('is_deleted', false)
          .single();
        let subjectId;
        if (!subjectError && subjectRow) {
          subjectId = subjectRow.subject_id;
        } else {
          const code = subject.substring(0, 10).toUpperCase().replace(/\s+/g, "_");
          const { data: inserted, error: upsertError } = await supabase
            .from('subjects')
            .upsert({
              school_id: schoolId,
              subject_name: subject,
              name: subject,  // also populate name for compatibility
              code
            }, { onConflict: 'school_id,code' })
            .select('subject_id')
            .single();
          if (upsertError) throw upsertError;
          subjectId = inserted.subject_id;
        }

      const grade = (typeof marksValue === 'number' && marksValue < 0) ? 'X' : calcGrade(marksValue, totalMarks);

      // Emulate upsert to bypass missing unique constraints on results table
      let finalResultId = null;

      const { data: existing, error: findErr } = await supabase
        .from('results')
        .select('result_id')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .eq('subject', subject)
        .eq('term', term)
        .eq('is_deleted', false)
        .maybeSingle();

      if (findErr) {
        throw findErr;
      } else if (existing) {
        const { data: updated, error: updateErr } = await supabase
          .from('results')
          .update({
            marks: Number(marksValue),
            total_marks: Number(totalMarks),
            grade,
            class_id: resolvedClassId,
            exam_id: resolvedExamId || null,
            updated_at: new Date().toISOString()
          })
          .eq('result_id', existing.result_id)
          .select('result_id')
          .single();
        if (updateErr) throw updateErr;
        if (updated) finalResultId = updated.result_id;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('results')
          .insert({
            school_id: schoolId,
            student_id: studentId,
            subject,
            class_id: resolvedClassId,
            marks: Number(marksValue),
            total_marks: Number(totalMarks),
            grade,
            term,
            exam_id: resolvedExamId || null
          })
          .select('result_id')
          .single();
        if (insertErr) throw insertErr;
        if (inserted) finalResultId = inserted.result_id;
      }

      saved.push({ subjectId, resultId: finalResultId });
        
        // NEW: Log grade creation/update
        await logAuditEvent(req, AUDIT_ACTIONS.GRADE_CREATE, {
          entityId: finalResultId,
          entityType: 'result',
          description: `Grade recorded for student ${studentId} in ${subject}: ${marks}/${totalMarks} (${grade})`,
          newValues: { studentId, subject, marks, totalMarks: totalMarks, grade, term }
        });
    }

        try {
        res.status(201).json({
        saved: saved.length,
        message: `${saved.length} result(s) saved`
        });
} catch (err) {
  next(err);
};

// ─── PUT /api/grades/:id — update a single result ────────────────────────────
router.put("/:id", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { marks, totalMarks, subject, term, teacherComment } = req.body;

    // Normalize special input marks if provided (strings like 'absent','cheat','na')
    let marksValue = marks;
    if (typeof marks === 'string') {
      const key = marks.trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(INPUT_SPECIAL_MAP, key)) {
        marksValue = INPUT_SPECIAL_MAP[key];
      } else {
        marksValue = Number(marks);
      }
    } else {
      marksValue = marks != null ? Number(marks) : null;
    }

    const t = Number(totalMarks || 100);
    let grade;
    if (marksValue === null) {
      grade = null;
    } else if (typeof marksValue === 'number' && marksValue < 0) {
      grade = 'X';
    } else {
      const m = Number(marksValue);
      const pct = (m / (t || 1)) * 100;
      grade = pct >= 80 ? "EE" : pct >= 65 ? "ME" : pct >= 50 ? "AE" : "BE";
    }

    // Build update data
    const updateData = {
      marks: marksValue === null ? null : Number(marksValue),
      total_marks: t,
      grade,
      term,
      teacher_comment: teacherComment || null,
      updated_at: new Date().toISOString()
    };

    // If subject name provided, resolve subject_id
    if (subject) {
      const { data: subjectRow, error: subjectError } = await supabase
        .from('subjects')
        .select('subject_id')
        .eq('school_id', schoolId)
        .eq('subject_name', subject)
        .eq('is_deleted', false)
        .single();
      if (!subjectError && subjectRow) {
        updateData.subject_id = subjectRow.subject_id;
      }
    }
    const { data: updated, error: updateError } = await supabase
      .from('results')
      .update(updateData)
      .eq('result_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('result_id')
      .single();
    if (updateError) throw updateError;
    if (!updated) return res.status(404).json({ message: "Result not found" });
    
    // NEW: Log grade update
    await logAuditEvent(req, AUDIT_ACTIONS.GRADE_UPDATE, {
      entityId: req.params.id,
      entityType: 'result',
      description: `Grade updated for result ID ${req.params.id}: ${marks}/${totalMarks} (${grade})`,
      newValues: { marks, totalMarks: totalMarks, grade, term, teacherComment }
    });
    
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE /api/grades/:id — soft delete ────────────────────────────────────
router.delete("/:id", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: updated, error } = await supabase
      .from('results')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('result_id', req.params.id)
      .eq('school_id', schoolId)
      .select('result_id')
      .single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Result not found" });
    
    // NEW: Log grade deletion
    await logAuditEvent(req, AUDIT_ACTIONS.GRADE_DELETE, {
      entityId: req.params.id,
      entityType: 'result',
      description: `Grade deleted for result ID ${req.params.id}`
    });
    
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
