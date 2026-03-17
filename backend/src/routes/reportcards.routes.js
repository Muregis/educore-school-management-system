import { Router } from "express";
import { pool, supabase } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// GET report cards
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, term, academicYear } = req.query;
    // OLD: let sql = `SELECT rc.*, CONCAT(s.first_name,' ',s.last_name) AS student_name, s.class_name, s.admission_number
    // OLD:             FROM report_cards rc JOIN students s ON s.student_id = rc.student_id
    // OLD:             WHERE rc.school_id=$1 AND rc.is_deleted=false`;
    // OLD: const params = [schoolId];
    // OLD: if (studentId) { sql += " AND rc.student_id=?"; params.push(studentId); }
    // OLD: if (term)       { sql += " AND rc.term=?"; params.push(term); }
    // OLD: if (academicYear) { sql += " AND rc.academic_year=?"; params.push(academicYear); }
    // OLD: sql += " ORDER BY rc.created_at DESC";
    // OLD: const [rows] = await pgPool.query(sql, params);
    // OLD: res.json(rows);

    // NEW: Supabase-native query (no raw SQL, preserves tenant filter)
    let query = supabase
      .from("report_cards")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (studentId) query = query.eq("student_id", studentId);
    if (term) query = query.eq("term", term);
    if (academicYear) query = query.eq("academic_year", academicYear);

    const { data: cards, error } = await query;
    if (error) {
      // If the table hasn't been deployed to Supabase yet, avoid 500s on the frontend.
      if (error.code === "PGRST205") {
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
    if (stuErr) throw stuErr;

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
    const { schoolId } = req.user;
    const { term = "Term 2", academicYear = "2026" } = req.query;
    const { studentId } = req.params;

    // OLD: const [[student]] = await pool.query(
    // OLD:   `SELECT s.*, CONCAT(s.first_name,' ',s.last_name) AS full_name FROM students s WHERE s.student_id=? AND s.school_id=?`,
    // OLD:   [studentId, schoolId]
    // OLD: );
    const { data: studentRow, error: studentErr } = await supabase
      .from("students")
      .select("*, first_name, last_name")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .limit(1)
      .single();
    if (studentErr) throw studentErr;
    const student = studentRow
      ? { ...studentRow, full_name: `${studentRow.first_name || ""} ${studentRow.last_name || ""}`.trim() }
      : null;
    if (!student) return res.status(404).json({ message: "Student not found" });

    // OLD: const [results] = await pool.query(
    // OLD:   `SELECT r.subject, r.marks, r.grade, r.teacher_comment,
    // OLD:           t.first_name AS teacher_first, t.last_name AS teacher_last
    // OLD:   FROM results r
    // OLD:   LEFT JOIN teachers t ON t.teacher_id = r.teacher_id
    // OLD:   WHERE r.student_id=? AND r.school_id=? AND r.term=?`,
    // OLD:   [studentId, schoolId, term]
    // OLD: );
    const { data: resultsRows, error: resultsErr } = await supabase
      .from("results")
      .select("subject, marks, grade, teacher_comment, teacher_id, teachers(first_name,last_name)")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("term", term);
    if (resultsErr) throw resultsErr;
    const results = (resultsRows || []).map(r => ({
      subject: r.subject,
      marks: r.marks,
      grade: r.grade,
      teacher_comment: r.teacher_comment,
      teacher_first: r.teachers?.first_name ?? null,
      teacher_last: r.teachers?.last_name ?? null,
    }));

    // OLD: const [attendance] = await pool.query(
    // OLD:   `SELECT COUNT(*) AS total,
    // OLD:           SUM(status='present') AS present,
    // OLD:           SUM(status='absent')  AS absent
    // OLD:   FROM attendance WHERE student_id=? AND school_id=?`,
    // OLD:   [studentId, schoolId]
    // OLD: );
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

    // OLD: const [rc] = await pool.query(
    // OLD:   `SELECT * FROM report_cards WHERE student_id=? AND school_id=? AND term=? AND academic_year=? AND is_deleted=0 LIMIT 1`,
    // OLD:   [studentId, schoolId, term, academicYear]
    // OLD: );
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
      if (rcErr.code !== "PGRST205") throw rcErr;
      reportCard = null;
    } else {
      reportCard = rcRow || null;
    }

    const avg = results.length ? (results.reduce((s,r) => s + Number(r.marks), 0) / results.length).toFixed(1) : 0;

    res.json({
      student,
      results,
      attendance: attendanceCounts,
      reportCard,
      average: avg,
      term,
      academicYear,
    });
  } catch (err) { next(err); }
});

// POST create/update report card
router.post("/", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, term = "Term 2", academicYear = "2026", classTeacherComment, principalComment, conduct = "Good", daysPresent = 0, daysAbsent = 0, classPosition, outOf } = req.body;
    if (!studentId) return res.status(400).json({ message: "studentId is required" });

    await pool.query(
      `INSERT INTO report_cards (school_id, student_id, term, academic_year, class_teacher_comment, principal_comment, conduct, days_present, days_absent, class_position, out_of, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE class_teacher_comment=VALUES(class_teacher_comment), principal_comment=VALUES(principal_comment),
      conduct=VALUES(conduct), days_present=VALUES(days_present), days_absent=VALUES(days_absent),
      class_position=VALUES(class_position), out_of=VALUES(out_of), generated_at=NOW(), updated_at=CURRENT_TIMESTAMP`,
      [schoolId, studentId, term, academicYear, classTeacherComment||null, principalComment||null, conduct, daysPresent, daysAbsent, classPosition||null, outOf||null]
    );
    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

export default router;