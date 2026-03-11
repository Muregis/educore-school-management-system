import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// GET report cards
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, term, academicYear } = req.query;
    let sql = `SELECT rc.*, CONCAT(s.first_name,' ',s.last_name) AS student_name, s.class_name, s.admission_number
                FROM report_cards rc JOIN students s ON s.student_id = rc.student_id
                WHERE rc.school_id=? AND rc.is_deleted=0`;
    const params = [schoolId];
    if (studentId) { sql += " AND rc.student_id=?"; params.push(studentId); }
    if (term)       { sql += " AND rc.term=?"; params.push(term); }
    if (academicYear) { sql += " AND rc.academic_year=?"; params.push(academicYear); }
    sql += " ORDER BY rc.created_at DESC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET full report card data for one student (with grades)
router.get("/:studentId/full", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term = "Term 2", academicYear = "2026" } = req.query;
    const { studentId } = req.params;

    const [[student]] = await pool.query(
      `SELECT s.*, CONCAT(s.first_name,' ',s.last_name) AS full_name FROM students s WHERE s.student_id=? AND s.school_id=?`,
      [studentId, schoolId]
    );
    if (!student) return res.status(404).json({ message: "Student not found" });

    const [results] = await pool.query(
      `SELECT r.subject, r.marks, r.grade, r.teacher_comment,
              t.first_name AS teacher_first, t.last_name AS teacher_last
      FROM results r
      LEFT JOIN teachers t ON t.teacher_id = r.teacher_id
      WHERE r.student_id=? AND r.school_id=? AND r.term=?`,
      [studentId, schoolId, term]
    );

    const [attendance] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(status='present') AS present,
              SUM(status='absent')  AS absent
      FROM attendance WHERE student_id=? AND school_id=?`,
      [studentId, schoolId]
    );

    const [rc] = await pool.query(
      `SELECT * FROM report_cards WHERE student_id=? AND school_id=? AND term=? AND academic_year=? AND is_deleted=0 LIMIT 1`,
      [studentId, schoolId, term, academicYear]
    );

    const avg = results.length ? (results.reduce((s,r) => s + Number(r.marks), 0) / results.length).toFixed(1) : 0;

    res.json({
      student,
      results,
      attendance: attendance[0],
      reportCard: rc[0] || null,
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