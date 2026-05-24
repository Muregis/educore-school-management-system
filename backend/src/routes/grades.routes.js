import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";
import { upload } from "../app.js";

const router = Router();
router.use(authRequired);

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

// ─── Helper: map DB result row → camelCase shape frontend expects ─────────
function normalise(r) {
  return {
    id:             r.result_id,
    studentId:      r.student_id,
    studentName:    r.student_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    className:      r.class_name  ?? "",
    subject:        r.subject_name ?? r.subject ?? "",
    term:           r.term        ?? "Term 2",
    marks:          Number(r.marks ?? 0),
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

// ─── POST /api/grades/bulk — save multiple subjects for one student ───────────
router.post("/bulk", requireRoles("admin", "teacher"), async (req, res, next) => {
try {
    const { schoolId } = req.user;
    const { studentId, classId, term = "Term 2", totalMarks = 100, subjects = [], examId } = req.body;

    if (!studentId || !subjects.length)
    return res.status(400).json({ message: "studentId and subjects[] are required" });

    // Verify student belongs to this school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id, class_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();
    if (studentError || !student) return res.status(404).json({ message: "Student not found" });

    const resolvedClassId = classId || student.class_id;

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
            }, { onConflict: 'school_id,subject_name' })
            .select('subject_id')
            .single();
          if (upsertError) throw upsertError;
          subjectId = inserted.subject_id;
        }

      const grade = (typeof marksValue === 'number' && marksValue < 0) ? 'X' : calcGrade(marksValue, totalMarks);

      // Upsert — update if already exists for this student/subject combo
        const { data: upserted, error: upsertError } = await supabase
          .from('results')
            .upsert({
            school_id: schoolId,
            student_id: studentId,
            subject,
            class_id: resolvedClassId,
            marks: Number(marksValue),
            total_marks: Number(totalMarks),
            grade,
            term
          }, { onConflict: 'school_id,student_id,subject,term' })
          .select('result_id')
          .single();
        if (upsertError) throw upsertError;
        saved.push({ subjectId, resultId: upserted.result_id });
        
        // NEW: Log grade creation/update
        await logAuditEvent(req, AUDIT_ACTIONS.GRADE_CREATE, {
          entityId: upserted.result_id,
          entityType: 'result',
          description: `Grade recorded for student ${studentId} in ${subject}: ${marks}/${totalMarks} (${grade})`,
          newValues: { studentId, subject, marks, totalMarks: totalMarks, grade, term }
        });
    }

    res.status(201).json({ saved: saved.length, message: `${saved.length} result(s) saved` });
} catch (err) { next(err); }
});

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

// ─── POST /api/grades/import — import grades from CSV ───────────────────────
router.post("/import", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { csvData, term = "Term 2", totalMarks = 100 } = req.body;

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return res.status(400).json({ message: "CSV data is required and must be a non-empty array" });
    }

    // Expected CSV format: Student Name, Class, Subject, Marks
    // Optional: Term, Total Marks (will use parameters if not provided)
    const saved = [];
    const errors = [];

    for (let rowIndex = 0; rowIndex < csvData.length; rowIndex++) {
      const row = csvData[rowIndex];
      if (!row || row.length < 4) {
        errors.push(`Row ${rowIndex + 1}: Insufficient data (expected at least 4 columns)`);
        continue;
      }

      const [studentName, className, subject, marks] = row;
      let rowTerm = term;
      let rowTotalMarks = totalMarks;

      // Check if term and total marks are provided in CSV (columns 5 and 6)
      if (row.length >= 5 && row[4]) {
        rowTerm = row[4];
      }
      if (row.length >= 6 && row[5]) {
        const parsedTotal = parseInt(row[5], 10);
        if (!isNaN(parsedTotal)) {
          rowTotalMarks = parsedTotal;
        }
      }

      try {
        // Find student by name and class
        const { data: studentRows, error: studentError } = await supabase
          .from('students')
          .select('student_id, first_name, last_name, class_name, class_id')
          .eq('school_id', schoolId)
          .eq('is_deleted', false);

        if (studentError) throw studentError;

        const student = studentRows.find(s => {
          const fullName = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
          return fullName.toLowerCase() === studentName.trim().toLowerCase() && 
                 s.class_name?.toLowerCase() === className.trim().toLowerCase();
        });

        if (!student) {
          errors.push(`Row ${rowIndex + 1}: Student "${studentName}" in class "${className}" not found`);
          continue;
        }

        // Validate teacher class access for teachers
        const { role, userId } = req.user;
        if (role === "teacher") {
          const { data: teacherClasses, error: teacherError } = await supabase
            .from("teacher_classes")
            .select("class_id")
            .eq("school_id", schoolId)
            .eq("teacher_id", userId)
            .eq("is_deleted", false);
          if (teacherError) throw teacherError;

          const teacherClassIds = teacherClasses?.map(tc => tc.class_id).filter(Boolean) || [];
          if (!teacherClassIds.includes(student.class_id)) {
            errors.push(`Row ${rowIndex + 1}: Teacher can only access grades for their assigned classes`);
            continue;
          }
        }

        // Find or create subject
        let { data: subjectRows, error: subjectError } = await supabase
          .from('subjects')
          .select('subject_id')
          .eq('school_id', schoolId)
          .eq('subject_name', subject)
          .eq('is_deleted', false)
          .single();

        if (subjectError && subjectError.code !== 'PGRST116') { // PGRST116 means no rows returned
          throw subjectError;
        }

        let subjectId;
        if (!subjectRows) {
          // Create subject
          const code = subject.substring(0, 10).toUpperCase().replace(/\s+/g, "_");
          const { data: insertedSubject, error: insertSubjectError } = await supabase
            .from('subjects')
            .insert({
              school_id: schoolId,
              subject_name: subject,
              name: subject,
              code
            })
            .select('subject_id')
            .single();

          if (insertSubjectError) throw insertSubjectError;
          subjectId = insertedSubject.subject_id;
        } else {
          subjectId = subjectRows.subject_id;
        }

        // Resolve or create a default exam for the term if not provided
        let { data: exam, error: examError } = await supabase
          .from('exams')
          .select('exam_id')
          .eq('school_id', schoolId)
          .eq('term', rowTerm)
          .eq('is_deleted', false)
          .single();

        let resolvedExamId;
        if (!examError && exam) {
          resolvedExamId = exam.exam_id;
        } else {
          const currentYear = new Date().getFullYear();
          const { data: insertedExam, error: insertExamError } = await supabase
            .from('exams')
            .insert({
              school_id: schoolId,
              exam_name: `${rowTerm} Exam`,
              term: rowTerm,
              academic_year: currentYear,
              status: 'published'
            })
            .select('exam_id')
            .single();

          if (insertExamError) throw insertExamError;
          resolvedExamId = insertedExam.exam_id;
        }

        // Normalize marks
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

        // Skip if marksValue is explicitly null (N/A / not assessed)
        if (marksValue === null) {
          continue;
        }

        // Calculate grade
        const calcGrade = (marks, total) => {
          const pct = (Number(marks) / Number(total || 1)) * 100;
          if (pct >= 80) return "EE";
          if (pct >= 65) return "ME";
          if (pct >= 50) return "AE";
          return "BE";
        };

        const grade = (typeof marksValue === 'number' && marksValue < 0) ? 'X' : calcGrade(marksValue, rowTotalMarks);

        // Upsert result
        const { data: upserted, error: upsertError } = await supabase
          .from('results')
          .upsert({
            school_id: schoolId,
            student_id: student.student_id,
            subject,
            class_id: student.class_id,
            marks: Number(marksValue),
            total_marks: Number(rowTotalMarks),
            grade,
            term: rowTerm
          }, { onConflict: 'school_id,student_id,subject,term' })
          .select('result_id')
          .single();

        if (upsertError) throw upsertError;

        saved.push({
          studentId: student.student_id,
          studentName: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
          className: student.class_name,
          subject,
          marks: marksValue,
          total: rowTotalMarks,
          grade,
          term: rowTerm
        });

        // Log grade creation/update
        await logAuditEvent(req, AUDIT_ACTIONS.GRADE_CREATE, {
          entityId: upserted.result_id,
          entityType: 'result',
          description: `Grade imported for student ${student.student_id} in ${subject}: ${marksValue}/${rowTotalMarks} (${grade})`,
          newValues: {
            studentId: student.student_id,
            subject,
            marks: marksValue,
            totalMarks: rowTotalMarks,
            grade,
            term: rowTerm
          }
        });
      } catch (rowError) {
        errors.push(`Row ${rowIndex + 1}: ${rowError.message}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        saved: saved.length, 
        errors,
        message: `${saved.length} result(s) imported, ${errors.length} error(s)`
      });
    }

    res.status(201).json({ 
      saved: saved.length, 
      message: `${saved.length} result(s) imported successfully` 
    });
  } catch (err) {
    next(err);
  }
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

// ─── POST /api/grades/import — bulk import grades from CSV ─────────────────────
// CSV format: Student Name, Admission Number, Subject1, Subject2, ..., Term
// Marks left empty = N/A (not assessed)
// System auto-calculates grade, mean score and position/rank
router.post("/import", requireRoles("admin", "teacher"), upload.single("file"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;

    if (!req.file) return res.status(400).json({ message: "No CSV file uploaded" });

    const csvText = req.file.buffer.toString("utf-8");
    const lines = csvText.replace(/\r/g, "").split("\n").filter(Boolean);

    if (lines.length < 2) return res.status(400).json({ message: "CSV file is empty or has no data rows" });

    // Parse header row (strip optional BOM, trim spaces)
    const headerLine = lines[0].replace(/^\uFEFF/, "").trim();
    const headers = headerLine.split(",").map(h => h.trim());

    // Identify key columns
    const getNameIdx   = () => headers.findIndex(h => h.toLowerCase().includes("name"));
    const getAdmIdx    = () => headers.findIndex(h => 
      h.toLowerCase().includes("admission") || h.toLowerCase().includes("adm") || h.toLowerCase().includes("reg")
    );
    const getTermIdx   = () => headers.findIndex(h => h.toLowerCase().includes("term"));

    const nameIdx   = getNameIdx();
    const admIdx    = getAdmIdx();
    const termIdx   = getTermIdx();
    const term      = (termIdx >= 0 && lines[1]?.split(",")[termIdx]?.trim()) || "Term 1";

    // Subject columns = all non-key columns after the first 2 key columns (name, admission number)
    // Key columns are: name, admno; everything else is a subject (or term column)
    // Strategy: subject columns = all header indices NOT name/adm/term
    const keyIndices = new Set([nameIdx, admIdx, termIdx].filter(i => i >= 0));
    const subjectIndices = headers
      .map((h, i) => i)
      .filter(i => !keyIndices.has(i));

    if (subjectIndices.length === 0) {
      return res.status(400).json({ message: "No subject columns found in CSV header" });
    }
    if (admIdx < 0) {
      return res.status(400).json({ message: "Admission Number column not found in CSV. Column must be named 'Admission Number' or 'Adm No'" });
    }

    const subjectColumns = subjectIndices.map(i => headers[i]);

    // Parse data rows
    const rows = lines.slice(1).filter(l => l.trim()).map(line => {
      const cells = line.split(",").map(c => c.trim());
      return {
        admissionNumber: cells[admIdx] || "",
        studentName:     nameIdx >= 0 ? (cells[nameIdx] || "") : "",
        term:             term, // single term for this import batch
        marks: subjectColumns.reduce((acc, col, subIdx) => {
          const raw = cells[subjectIndices[subIdx]] || "";
          acc[col] = raw;
          return acc;
        }, {}),
      };
    });

    // Resolve all admission numbers to student IDs for this school
    const uniqueAdmNos = [...new Set(rows.map(r => r.admissionNumber).filter(Boolean))];
    let studentMap = {}; // admission_number (normalised) → student record

    if (uniqueAdmNos.length > 0) {
      const { data: studentRows, error: studentsErr } = await supabase
        .from("students")
        .select("student_id, admission_number, first_name, last_name, class_id, class_name")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .in("admission_number", uniqueAdmNos);

      if (studentsErr) throw studentsErr;

      for (const s of (studentRows || [])) {
        studentMap[String(s.admission_number).trim().toLowerCase()] = s;
      }
    }

    const INPUT_SPECIAL_MAP = {
      absent: -1, x: -1, cheat: -3, y: -3, inc: -2, incomplete: -2, medical: -4, na: null, n/a: null,
    };

    const calcGrade = (marks, total) => {
      const pct = (Number(marks) / Number(total || 1)) * 100;
      if (pct >= 80) return "EE";
      if (pct >= 65) return "ME";
      if (pct >= 50) return "AE";
      return "BE";
    };

    let imported = 0;
    let skipped  = 0;
    let notFound = 0;

    for (const row of rows) {
      const admKey = row.admissionNumber.trim().toLowerCase();
      const student = studentMap[admKey];

      if (!student) {
        notFound++;
        skipped++;
        continue;
      }

      const resolvedClassId = student.class_id || null;

      // Upsert exam record for this term (create if not exists)
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

      // Subject map used for MISSING subject detection
      const subjectsRow = {};
      for (const sub of subjectColumns) {
        const raw = row.marks[sub] ?? "";
        const key = String(raw).trim().toLowerCase();

        if (!raw) {
          subjectsRow[sub] = null; // blank = N/A → skip saving
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

      // --- Detect and CLEAR subjects NOT in the current CSV row (tombstone) ---
      // If a subject was previously saved for this student/term but is absent from the
      // current CSV row, mark it N/A so scores only reflect what is in the CSV.
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

      // Upsert each subject
      for (const subject of subjectColumns) {
        const entry = subjectsRow[subject];
        if (entry === null) continue; // N/A or blank → not saved

        const { marksValue, grade } = entry;

        // Resolve or create subject record
        let subjectId;
        const { data: subjectRow, error: subjErr } = await supabase
          .from("subjects")
          .select("subject_id")
          .eq("school_id", schoolId)
          .eq("subject_name", subject)
          .eq("is_deleted", false)
          .single();
        if (!subjErr && subjectRow) {
          subjectId = subjectRow.subject_id;
        } else {
          const code = subject.substring(0, 10).toUpperCase().replace(/\s+/g, "_");
          const { data: ins, error: insErr } = await supabase
            .from("subjects")
            .upsert({
              school_id: schoolId,
              subject_name: subject,
              name: subject,
              code,
            }, { onConflict: "school_id,subject_name" })
            .select("subject_id")
            .single();
          if (insErr) throw insErr;
          subjectId = ins.subject_id;
        }

        const finalGrade = (marksValue < 0) ? "X" : grade;

        // Upsert result
        const { error: upsertErr } = await supabase
          .from("results")
          .upsert({
            school_id: schoolId,
            student_id: studentId,
            subject,
            class_id: resolvedClassId,
            marks: marksValue < 0 ? null : marksValue,
            total_marks: totalMarks,
            grade: finalGrade,
            term: row.term,
            exam_id: resolvedExamId || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "school_id,student_id,subject,term" });

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

export default router;
