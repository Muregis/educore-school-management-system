import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin","teacher"));

// Summary dashboard stats
router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [[{ totalStudents }]] = await pool.query(`SELECT COUNT(*) AS totalStudents FROM students WHERE school_id=? AND is_deleted=0`, [schoolId]);
    const [[{ totalTeachers }]] = await pool.query(`SELECT COUNT(*) AS totalTeachers FROM teachers WHERE school_id=? AND is_deleted=0`, [schoolId]);
    const [[{ totalCollected }]] = await pool.query(`SELECT COALESCE(SUM(amount),0) AS totalCollected FROM payments WHERE school_id=? AND status='paid'`, [schoolId]);
    const [[{ totalPending }]]   = await pool.query(`SELECT COALESCE(SUM(amount),0) AS totalPending FROM payments WHERE school_id=? AND status='pending'`, [schoolId]);
    const [[{ presentToday }]]   = await pool.query(`SELECT COUNT(*) AS presentToday FROM attendance WHERE school_id=? AND attendance_date=CURDATE() AND status='present'`, [schoolId]);
    const [[{ absentToday }]]    = await pool.query(`SELECT COUNT(*) AS absentToday FROM attendance WHERE school_id=? AND attendance_date=CURDATE() AND status='absent'`, [schoolId]);
    res.json({ totalStudents, totalTeachers, totalCollected, totalPending, presentToday, absentToday });
  } catch (err) { next(err); }
});

// Monthly fee collection
router.get("/monthly-fee-collection", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(payment_date,'%Y-%m') AS month,
              SUM(amount) AS collected,
              COUNT(*) AS transactions
       FROM payments WHERE school_id=? AND status='paid'
       GROUP BY month ORDER BY month DESC LIMIT 12`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Attendance rate by class
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
       WHERE a.school_id=?
       GROUP BY s.class_name
       ORDER BY s.class_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Fee defaulters
router.get("/fee-defaulters", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.admission_number,
              s.class_name, s.parent_phone,
              COALESCE(fs.tuition + fs.activity + fs.misc, 0) AS expected,
              COALESCE(SUM(p.amount),0) AS paid,
              COALESCE(fs.tuition + fs.activity + fs.misc, 0) - COALESCE(SUM(p.amount),0) AS balance
       FROM students s
       LEFT JOIN fee_structures fs ON fs.class_name=s.class_name AND fs.school_id=s.school_id
       LEFT JOIN payments p ON p.student_id=s.student_id AND p.status='paid'
       WHERE s.school_id=? AND s.is_deleted=0
       GROUP BY s.student_id
       HAVING balance > 0
       ORDER BY balance DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Grade distribution by subject
router.get("/grade-distribution", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT subject,
              AVG(score) AS avgScore,
              MAX(score) AS highest,
              MIN(score) AS lowest,
              COUNT(*) AS entries
       FROM grades WHERE school_id=?
       GROUP BY subject ORDER BY subject`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Student report card
router.get("/student/:studentId", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const [[student]] = await pool.query(
      `SELECT student_id, first_name, last_name, admission_number, class_name, gender FROM students WHERE student_id=? AND school_id=? AND is_deleted=0`,
      [studentId, schoolId]
    );
    if (!student) return res.status(404).json({ message: "Student not found" });

    const [grades] = await pool.query(
      `SELECT subject, term, score, grade, teacher_comment FROM grades WHERE student_id=? AND school_id=? ORDER BY term, subject`,
      [studentId, schoolId]
    );
    const [attendance] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM attendance WHERE student_id=? AND school_id=? GROUP BY status`,
      [studentId, schoolId]
    );
    const [payments] = await pool.query(
      `SELECT SUM(amount) AS paid FROM payments WHERE student_id=? AND school_id=? AND status='paid'`,
      [studentId, schoolId]
    );

    res.json({ student, grades, attendance, totalPaid: payments[0]?.paid || 0 });
  } catch (err) { next(err); }
});

export default router;