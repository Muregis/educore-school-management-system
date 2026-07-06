import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

function resultPercent(marks, totalMarks = 100) {
  const s = String(marks ?? "").trim().toLowerCase();
  if (["na", "n/a", "absent", "cheat", "x", "y", "inc", "incomplete"].includes(s)) return null;
  const m = Number(marks);
  const t = Number(totalMarks || 100);
  if (Number.isNaN(m) || m < 0 || !t) return null;
  return (m / t) * 100;
}

function meanPercentFromResults(rows) {
  const percents = (rows || [])
    .map(r => resultPercent(r.marks, r.total_marks))
    .filter(p => p != null);
  if (!percents.length) return 0;
  return percents.reduce((a, b) => a + b, 0) / percents.length;
}

async function computeClassPosition(schoolId, studentId, term, className) {
  if (!className) return { classPosition: null, outOf: null };

  const { data: classmates, error: stuErr } = await supabase
    .from("students")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("class_name", className)
    .eq("is_deleted", false)
    .eq("status", "active");
  if (stuErr) throw stuErr;

  const classStudentIds = (classmates || []).map(s => s.student_id);
  if (!classStudentIds.length) return { classPosition: null, outOf: null };

  const { data: classResults, error: resErr } = await supabase
    .from("results")
    .select("student_id, marks, total_marks")
    .eq("school_id", schoolId)
    .eq("term", term)
    .eq("is_deleted", false)
    .in("student_id", classStudentIds);
  if (resErr) throw resErr;

  const byStudent = new Map();
  for (const r of classResults || []) {
    const p = resultPercent(r.marks, r.total_marks);
    if (p == null) continue;
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
    byStudent.get(r.student_id).push(p);
  }

  const ranked = [...byStudent.entries()]
    .map(([sid, percents]) => ({
      student_id: sid,
      mean: percents.reduce((a, b) => a + b, 0) / percents.length,
    }))
    .filter(s => s.mean > 0)
    .sort((a, b) => b.mean - a.mean);

  if (!ranked.length) return { classPosition: null, outOf: null };

  let currentRank = 1;
  let prevMean = null;
  const withRanks = ranked.map((s, idx) => {
    if (prevMean !== null && s.mean < prevMean - 0.0001) currentRank = idx + 1;
    prevMean = s.mean;
    return { ...s, rank: currentRank };
  });

  const mine = withRanks.find(s => String(s.student_id) === String(studentId));
  return {
    classPosition: mine?.rank ?? null,
    outOf: withRanks.length,
  };
}

// GET report cards
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;
    const { studentId, term, academicYear, class: className } = req.query;
    let query = supabase
      .from("report_cards")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    // Parents and students can only see published report cards
    if (role === "parent" || role === "student") {
      query = query.eq("is_published", true).eq("is_approved", true);
    }

    if (studentId) query = query.eq("student_id", studentId);
    if (term) query = query.eq("term", term);
    if (academicYear) query = query.eq("academic_year", academicYear);
    if (className) query = query.eq("class_name", className);

    const { data: cards, error } = await query;
    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return res.json([]);
      }
      throw error;
    }

    const rows = cards || [];
    if (!rows.length) return res.json([]);

    const studentIds = Array.from(new Set(rows.map(r => r.student_id).filter(Boolean)));
    const { data: students, error: stuErr } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, class_name, admission_number")
      .eq("school_id", schoolId)
      .in("student_id", studentIds);
    if (stuErr) {
      if (stuErr.code === "PGRST205" || stuErr.message?.includes("does not exist")) {
        return res.json(rows);
      }
      throw stuErr;
    }

    const byId = new Map((students || []).map(s => [String(s.student_id), s]));
    const enriched = rows.map(rc => {
      const s = byId.get(String(rc.student_id));
      return {
        ...rc,
        student_name: s ? `${s.first_name || ""} ${s.last_name || ""}`.trim() : null,
        class_name: s?.class_name ?? null,
        admission_number: s?.admission_number ?? null,
      };
    });

    res.json(enriched);
  } catch (err) { next(err); }
});

// GET full report card data for one student (with grades)
router.get("/:studentId/full", async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;
    const { term, academicYear, examType } = req.query;
    const { studentId } = req.params;

    const { data: studentRow, error: studentErr } = await supabase
      .from("students")
      .select("*, first_name, last_name, photo_url")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .limit(1)
      .single();
    if (studentErr) throw studentErr;
    const student = studentRow
      ? { ...studentRow, full_name: `${studentRow.first_name || ""} ${studentRow.last_name || ""}`.trim() }
      : null;
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Fetch school branding from settings
    const { data: schoolRows, error: schoolErr } = await supabase
      .from("school_settings")
      .select("setting_key, setting_value")
      .eq("school_id", schoolId);
    if (schoolErr) console.error("School settings error:", schoolErr);
    const settingsMap = new Map((schoolRows || []).map(s => [s.setting_key, s.setting_value]));
    const schoolBranding = {
      logoUrl: settingsMap.get("school_logo") || settingsMap.get("logo_url") || null,
      schoolName: settingsMap.get("school_name") || null,
      schoolAddress: settingsMap.get("school_address") || null,
      schoolPhone: settingsMap.get("school_phone") || settingsMap.get("phone") || null,
      schoolEmail: settingsMap.get("school_email") || settingsMap.get("email") || null,
      primaryColor: settingsMap.get("primary_color") || "#C9A84C",
      secondaryColor: settingsMap.get("secondary_color") || "#3B82F6",
      headTeacherName: settingsMap.get("head_teacher_name") || null,
      customRemarks: settingsMap.get("report_remarks") || null,
      watermarkUrl: settingsMap.get("watermark_url") || null,
      backgroundColor: settingsMap.get("report_background_color") || "#FFFFFF",
      textColor: settingsMap.get("report_text_color") || "#1F2937",
      schoolStampUrl: settingsMap.get("school_stamp_url") || null,
      stampPosition: settingsMap.get("stamp_position") || "bottom-right",
    };

    // Build report card query based on role
    let rcQuery = supabase
      .from("report_cards")
      .select("*")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("is_deleted", false)
      .limit(1)
      .maybeSingle();

    // Apply filters if provided
    if (term) rcQuery = rcQuery.eq("term", term);
    if (academicYear) rcQuery = rcQuery.eq("academic_year", academicYear);
    if (examType) rcQuery = rcQuery.eq("exam_type", examType);

    let resultsQuery = supabase
      .from("results")
      .select("subject, marks, total_marks, grade, teacher_comment, teacher_id, exam_type, teachers(first_name,last_name)")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("is_deleted", false);
    
    // Apply term filter if provided
    if (term) resultsQuery = resultsQuery.eq("term", term);
    
    // Apply exam type filter if provided
    if (examType && examType !== "all") {
      resultsQuery = resultsQuery.eq("exam_type", examType);
    }
    
    const { data: resultsRows, error: resultsErr } = await resultsQuery;
    if (resultsErr) throw resultsErr;
    const results = (resultsRows || []).map(r => ({
      subject: r.subject,
      marks: r.marks,
      grade: r.grade,
      teacher_comment: r.teacher_comment,
      exam_type: r.exam_type,
      teacher_first: r.teachers?.first_name ?? null,
      teacher_last: r.teachers?.last_name ?? null,
    }));

    const { data: attendanceRows, error: attErr } = await supabase
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .eq("student_id", studentId);
    if (attErr) throw attErr;
    const attendanceCounts = { total: 0, present: 0, absent: 0 };
    (attendanceRows || []).forEach(r => {
      attendanceCounts.total += 1;
      if (r.status === "present") attendanceCounts.present += 1;
      if (r.status === "absent") attendanceCounts.absent += 1;
    });

    let reportCard = null;
    const { data: rcRow, error: rcErr } = await supabase
      .from("report_cards")
      .select("*")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("term", term)
      .eq("academic_year", academicYear)
      .eq("is_deleted", false)
      .limit(1)
      .maybeSingle();
    if (rcErr) {
      if (rcErr.code !== "PGRST205" && !rcErr.message?.includes("does not exist")) throw rcErr;
      reportCard = null;
    } else {
      reportCard = rcRow || null;
    }

    const avg = meanPercentFromResults(resultsRows).toFixed(1);

    const computedPosition = await computeClassPosition(
      schoolId,
      studentId,
      term,
      student.class_name
    );

    const classPosition = reportCard?.class_position ?? computedPosition.classPosition;
    const outOf = reportCard?.out_of ?? computedPosition.outOf;

    res.json({
      student,
      results,
      attendance: attendanceCounts,
      reportCard: reportCard
        ? { ...reportCard, class_position: classPosition, out_of: outOf }
        : classPosition
          ? { class_position: classPosition, out_of: outOf }
          : null,
      average: avg,
      classPosition,
      outOf,
      term,
      academicYear,
      branding: schoolBranding,
    });
  } catch (err) { next(err); }
});

// POST create/update report card
router.post("/", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, term = "Term 2", academicYear = "2026", classTeacherComment, principalComment, conduct = "Good", daysPresent = 0, daysAbsent = 0, classPosition, outOf, customRemarks, examName, gradingSystem } = req.body;
    if (!studentId) return res.status(400).json({ message: "studentId is required" });

    const { error } = await supabase
      .from('report_cards')
      .upsert({
        school_id: schoolId,
        student_id: studentId,
        term,
        academic_year: academicYear,
        class_teacher_comment: classTeacherComment || null,
        principal_comment: principalComment || null,
        conduct,
        days_present: daysPresent,
        days_absent: daysAbsent,
        class_position: classPosition || null,
        out_of: outOf || null,
        custom_remarks: customRemarks || null,
        exam_name: examName || null,
        grading_system: gradingSystem || null,
        generated_at: new Date().toISOString(),
        is_published: false,
        is_approved: false,
      }, { onConflict: 'school_id,student_id,term,academic_year' });
    if (error) throw error;
    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

// PUT approve report card (admin only)
router.put("/:id/approve", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { approve = true } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from("report_cards")
      .select("school_id")
      .eq("report_id", id)
      .eq("school_id", schoolId)
      .single();
    if (fetchErr) return res.status(404).json({ message: "Report card not found" });

    const { error } = await supabase
      .from("report_cards")
      .update({
        is_approved: approve,
        approved_by: approve ? req.user.name || "Admin" : null,
        approved_at: approve ? new Date().toISOString() : null,
      })
      .eq("report_id", id);
    if (error) throw error;

    res.json({ approved: approve });
  } catch (err) { next(err); }
});

// PUT publish report card (admin only)
router.put("/:id/publish", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { publish = true } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from("report_cards")
      .select("school_id, is_approved")
      .eq("report_id", id)
      .eq("school_id", schoolId)
      .single();
    if (fetchErr) return res.status(404).json({ message: "Report card not found" });

    if (publish && !existing.is_approved) {
      return res.status(400).json({ message: "Cannot publish: report card must be approved first" });
    }

    const { error } = await supabase
      .from("report_cards")
      .update({ is_published: publish })
      .eq("report_id", id);
    if (error) throw error;

    res.json({ published: publish });
  } catch (err) { next(err); }
});

// POST /api/reportcards/print - Generate/print report cards with filters
router.post("/print", requireRoles("admin", "director", "superadmin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { 
      term, 
      academicYear, 
      className, 
      examType,
      studentIds,
      format = "pdf" 
    } = req.body;

    // Build base query for students
    let studentsQuery = supabase
      .from("students")
      .select("student_id, first_name, last_name, class_name, admission_number")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .eq("status", "active");

    // Apply class filter
    if (className) {
      studentsQuery = studentsQuery.eq("class_name", className);
    }

    // Apply specific student IDs filter
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      studentsQuery = studentsQuery.in("student_id", studentIds);
    }

    const { data: students, error: studentsError } = await studentsQuery;
    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return res.status(404).json({ message: "No students found matching the criteria" });
    }

    // Fetch results for all students with filters
    const studentIdsList = students.map(s => s.student_id);
    let resultsQuery = supabase
      .from("results")
      .select("student_id, subject, marks, total_marks, grade, teacher_comment, exam_type, term")
      .eq("school_id", schoolId)
      .in("student_id", studentIdsList)
      .eq("is_deleted", false);

    // Apply term filter
    if (term) {
      resultsQuery = resultsQuery.eq("term", term);
    }

    // Apply exam type filter
    if (examType && examType !== "all") {
      resultsQuery = resultsQuery.eq("exam_type", examType);
    }

    const { data: results, error: resultsError } = await resultsQuery;
    if (resultsError) throw resultsError;

    // Group results by student
    const resultsByStudent = new Map();
    (results || []).forEach(r => {
      if (!resultsByStudent.has(r.student_id)) {
        resultsByStudent.set(r.student_id, []);
      }
      resultsByStudent.get(r.student_id).push(r);
    });

    // Build report data for each student
    const reportData = students.map(student => {
      const studentResults = resultsByStudent.get(student.student_id) || [];
      const meanScore = meanPercentFromResults(studentResults);
      
      return {
        student: {
          id: student.student_id,
          name: `${student.first_name} ${student.last_name}`.trim(),
          admissionNumber: student.admission_number,
          className: student.class_name
        },
        term: term || "All Terms",
        academicYear: academicYear || "All Years",
        examType: examType || "All Exams",
        results: studentResults,
        meanScore: meanScore.toFixed(1),
        totalSubjects: studentResults.length
      };
    });

    // Fetch school branding
    const { data: schoolRows, error: schoolErr } = await supabase
      .from("school_settings")
      .select("setting_key, setting_value")
      .eq("school_id", schoolId);
    
    const settingsMap = new Map((schoolRows || []).map(s => [s.setting_key, s.setting_value]));
    const schoolBranding = {
      schoolName: settingsMap.get("school_name") || "School Name",
      schoolAddress: settingsMap.get("school_address") || "",
      schoolPhone: settingsMap.get("school_phone") || "",
      schoolEmail: settingsMap.get("school_email") || "",
      logoUrl: settingsMap.get("school_logo") || null,
    };

    res.json({
      success: true,
      school: schoolBranding,
      filters: {
        term: term || "All Terms",
        academicYear: academicYear || "All Years",
        className: className || "All Classes",
        examType: examType || "All Exams"
      },
      reports: reportData,
      totalStudents: reportData.length,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

export default router;