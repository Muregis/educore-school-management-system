import { Router } from "express";
import { pgPool } from "../config/pg.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin", "teacher", "finance"));

// ─── Summary dashboard stats ──────────────────────────────────────────────────
router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [[{ totalStudents }]] = await pool.query(
      `SELECT COUNT(*) AS totalStudents FROM students WHERE school_id=? AND is_deleted=0`, [schoolId]);
    const [[{ totalTeachers }]] = await pool.query(
      `SELECT COUNT(*) AS totalTeachers FROM teachers WHERE school_id=? AND is_deleted=0`, [schoolId]);
    const [[{ totalCollected }]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS totalCollected FROM payments WHERE school_id=? AND status='paid' AND is_deleted=0`, [schoolId]);
    const [[{ totalPending }]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS totalPending FROM payments WHERE school_id=? AND status='pending' AND is_deleted=0`, [schoolId]);
    const [[{ presentToday }]] = await pool.query(
      `SELECT COUNT(*) AS presentToday FROM attendance WHERE school_id=? AND attendance_date=CURDATE() AND status='present' AND is_deleted=0`, [schoolId]);
    const [[{ absentToday }]] = await pool.query(
      `SELECT COUNT(*) AS absentToday FROM attendance WHERE school_id=? AND attendance_date=CURDATE() AND status='absent' AND is_deleted=0`, [schoolId]);
    res.json({ totalStudents, totalTeachers, totalCollected, totalPending, presentToday, absentToday });
  } catch (err) { next(err); }
});

// ─── Monthly fee collection ───────────────────────────────────────────────────
router.get("/monthly-fee-collection", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(payment_date,'%Y-%m') AS month,
              SUM(amount)  AS collected,
              COUNT(*)     AS transactions
      FROM payments
      WHERE school_id=? AND status='paid' AND is_deleted=0
      GROUP BY month ORDER BY month DESC LIMIT 12`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── Attendance rate by class ─────────────────────────────────────────────────
router.get("/attendance-rate", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT s.class_name,
              COUNT(*) AS total,
              SUM(a.status='present') AS present,
              ROUND(SUM(a.status='present')/COUNT(*)*100,1) AS rate
        FROM attendance a
        JOIN students s ON s.student_id=a.student_id
        WHERE a.school_id=? AND a.is_deleted=0
        GROUP BY s.class_name
        ORDER BY s.class_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── Fee defaulters ───────────────────────────────────────────────────────────
router.get("/fee-defaulters", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { rows } = await pgPool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.admission_number,
              s.class_name, s.parent_phone,
              COALESCE(f.tuition + f.activity + f.misc, 0) AS expected,
              COALESCE(SUM(p.amount), 0)           AS paid,
              COALESCE(f.tuition + f.activity + f.misc, 0) - COALESCE(SUM(p.amount), 0) AS balance
        FROM students s
        LEFT JOIN fee_structures f ON f.class_name = s.class_name AND f.school_id = s.school_id 
        LEFT JOIN payments p ON p.student_id = s.student_id AND p.status = 'paid'
        WHERE s.school_id = $1 AND s.is_deleted = false 
          AND (f.is_deleted = false OR f.is_deleted IS NULL)
          AND (p.is_deleted = false OR p.is_deleted IS NULL)
        GROUP BY s.student_id, s.first_name, s.last_name, s.admission_number, s.class_name, s.parent_phone, f.tuition, f.activity, f.misc
        HAVING balance > 0
        ORDER BY balance DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── Grade distribution by subject ───────────────────────────────────────────
router.get("/grade-distribution", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT r.subject AS subject,
              AVG(r.marks)  AS avgScore,
              MAX(r.marks)  AS highest,
              MIN(r.marks)  AS lowest,
              COUNT(*)               AS entries
        FROM results r
        WHERE r.school_id = ? AND r.is_deleted = 0
        GROUP BY r.subject
        ORDER BY r.subject`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── Student report card ──────────────────────────────────────────────────────
router.get("/student/:studentId", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;

    const [[student]] = await pool.query(
      `SELECT student_id, first_name, last_name, admission_number, class_name, gender
      FROM students WHERE student_id=? AND school_id=? AND is_deleted=0`,
      [studentId, schoolId]
    );
    if (!student) return res.status(404).json({ message: "Student not found" });

    const [grades] = await pool.query(
      `SELECT sub.subject_name AS subject,
              r.term,
              r.marks_obtained AS score,
              r.total_marks,
              r.grade,
              r.teacher_comment
        FROM results r
        JOIN subjects sub ON sub.subject_id = r.subject_id
        WHERE r.student_id=? AND r.school_id=? AND r.is_deleted=0
        ORDER BY r.term, sub.subject_name`,
      [studentId, schoolId]
    );

    const [attendance] = await pool.query(
      `SELECT status, COUNT(*) AS count
      FROM attendance WHERE student_id=? AND school_id=? AND is_deleted=0
      GROUP BY status`,
      [studentId, schoolId]
    );

    const [payments] = await pool.query(
      `SELECT SUM(amount) AS paid
      FROM payments WHERE student_id=? AND school_id=? AND status='paid' AND is_deleted=0`,
      [studentId, schoolId]
    );

    res.json({ student, grades, attendance, totalPaid: payments[0]?.paid || 0 });
  } catch (err) { next(err); }
});

export default router;
