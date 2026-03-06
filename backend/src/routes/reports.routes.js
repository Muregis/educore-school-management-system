import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

router.get("/summary", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [[counts]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM students WHERE school_id = ? AND is_deleted = 0) AS students,
         (SELECT COUNT(*) FROM teachers WHERE school_id = ? AND is_deleted = 0) AS teachers,
         (SELECT COUNT(*) FROM users WHERE school_id = ? AND is_deleted = 0) AS users,
         (SELECT COUNT(*) FROM payments WHERE school_id = ? AND is_deleted = 0) AS payments`,
      [schoolId, schoolId, schoolId, schoolId]
    );

    res.json(counts);
  } catch (err) {
    next(err);
  }
});

router.get("/monthly-fee-collection", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT school_id, ym, total_collected
       FROM v_monthly_fee_collection
       WHERE school_id = ?
       ORDER BY ym DESC`,
      [schoolId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/attendance-rate", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT school_id, attendance_date, attendance_rate_pct
       FROM v_attendance_rate
       WHERE school_id = ?
       ORDER BY attendance_date DESC`,
      [schoolId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/fee-defaulters", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT school_id, student_id, admission_number, student_name, class_name, expected_total, paid_total, balance_due
       FROM v_fee_defaulters
       WHERE school_id = ?
       ORDER BY balance_due DESC`,
      [schoolId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
