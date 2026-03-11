import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// Safe query helpers
async function sq(sql, params = []) {
  try { const [r] = await pool.query(sql, params); return r; } catch { return []; }
}
async function sq1(sql, params = []) {
  try { const [[r]] = await pool.query(sql, params); return r || {}; } catch { return {}; }
}

router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;

    // Individual counts — each wrapped so one failure doesn't kill the rest
    const totalStudents   = (await sq1(`SELECT COUNT(*) AS n FROM students  WHERE school_id=? AND is_deleted=0 AND status='active'`, [schoolId])).n || 0;
    const totalTeachers   = (await sq1(`SELECT COUNT(*) AS n FROM teachers  WHERE school_id=? AND is_deleted=0 AND status='active'`, [schoolId])).n || 0;
    const portalUsers     = (await sq1(`SELECT COUNT(*) AS n FROM users     WHERE school_id=? AND role IN ('parent','student') AND is_deleted=0`, [schoolId])).n || 0;
    const totalCollected  = (await sq1(`SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE school_id=? AND status='paid'    AND is_deleted=0`, [schoolId])).n || 0;
    const totalPending    = (await sq1(`SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE school_id=? AND status='pending' AND is_deleted=0`, [schoolId])).n || 0;
    const pendingAdmissions = (await sq1(`SELECT COUNT(*) AS n FROM admissions WHERE school_id=? AND status='pending' AND is_deleted=0`, [schoolId])).n || 0;

    const counts = { totalStudents, totalTeachers, portalUsers, totalCollected, totalPending, pendingAdmissions };

    // Monthly collections — last 6 months
    const monthly = await sq(
      `SELECT DATE_FORMAT(payment_date, '%b %Y') AS month,
              MONTH(payment_date) AS m, YEAR(payment_date) AS y,
              SUM(amount) AS total
      FROM payments
      WHERE school_id=? AND status='paid' AND is_deleted=0
        AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY y, m ORDER BY y, m`,
      [schoolId]
    );

    // Attendance this month
    const attendance = await sq(
      `SELECT status, COUNT(*) AS count
      FROM attendance
      WHERE school_id=? AND is_deleted=0
      AND attendance_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
      GROUP BY status`,
      [schoolId]
    );

    // Students per class
    const byClass = await sq(
      `SELECT class_name, COUNT(*) AS count FROM students
      WHERE school_id=? AND is_deleted=0 AND status='active'
      GROUP BY class_name ORDER BY class_name`,
      [schoolId]
    );

    // Grade distribution
    const grades = await sq(
      `SELECT grade, COUNT(*) AS count FROM results
      WHERE school_id=? AND is_deleted=0
      GROUP BY grade ORDER BY grade`,
      [schoolId]
    );

    // Recent payments
    const recentPayments = await sq(
      `SELECT p.amount, p.payment_date, p.payment_method, p.paid_by,
              CONCAT(s.first_name,' ',s.last_name) AS student_name, s.class_name
      FROM payments p
      JOIN students s ON s.student_id = p.student_id
      WHERE p.school_id=? AND p.status='paid' AND p.is_deleted=0
      ORDER BY p.payment_date DESC, p.payment_id DESC LIMIT 8`,
      [schoolId]
    );

    // Fee defaulters
    let defaultersCount = 0;
    try {
      const defaulters = await sq(
        `SELECT s.student_id,
                COALESCE(SUM(p.amount),0) AS paid,
                COALESCE((fs.tuition + fs.activity + fs.misc),0) AS expected
        FROM students s
        LEFT JOIN payments p  ON p.student_id=s.student_id AND p.status='paid' AND p.is_deleted=0
        LEFT JOIN fee_structures fs ON fs.class_name=s.class_name AND fs.school_id=s.school_id AND fs.is_deleted=0
        WHERE s.school_id=? AND s.is_deleted=0 AND s.status='active' AND fs.fee_structure_id IS NOT NULL
        GROUP BY s.student_id, fs.tuition, fs.activity, fs.misc
        HAVING paid < expected`,
        [schoolId]
      );
      defaultersCount = defaulters.length;
    } catch { /* ignore */ }

    // HR summary
    let hrSummary = null;
    if (["admin","hr"].includes(role)) {
      hrSummary = await sq1(
        `SELECT COUNT(*) AS totalStaff,
                COALESCE(SUM(salary),0) AS totalPayroll,
                SUM(status='active') AS activeStaff,
                SUM(status='on-leave') AS onLeave
         FROM hr_staff WHERE school_id=? AND is_deleted=0`,
        [schoolId]
      );
    }

    res.json({ counts, monthly, attendance, byClass, grades, recentPayments, defaultersCount, hrSummary });
  } catch (err) { next(err); }
});

export default router;