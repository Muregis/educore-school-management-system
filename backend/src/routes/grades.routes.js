import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";

const router = Router();
router.use(authRequired);

// ─── Helper: map DB result row → camelCase shape the frontend expects ─────────
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

// ─── GET /api/grades — list all results for the school ───────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, term, classId } = req.query;

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
              code
            }, { onConflict: 'school_id,subject_name' })
            .select('subject_id')
            .single();
          if (upsertError) throw upsertError;
          subjectId = inserted.subject_id;
        }

    const grade = calcGrade(marks, totalMarks);

      // Upsert — update if already exists for this student/subject combo
        const { data: upserted, error: upsertError } = await supabase
          .from('results')
          .upsert({
            school_id: schoolId,
            student_id: studentId,
            subject,
            class_id: resolvedClassId,
            marks: Number(marks),
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

    const m = Number(marks);
    const t = Number(totalMarks || 100);
    const pct = (m / (t || 1)) * 100;
    const grade = pct >= 80 ? "EE" : pct >= 65 ? "ME" : pct >= 50 ? "AE" : "BE";

    // Build update data
    const updateData = {
      marks: m,
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
