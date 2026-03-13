import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { sendEmail, isEmailConfigured, templates } from "../services/email.service.js";
import { logActivity } from "../helpers/activity.logger.js";

const router = Router();
router.use(authRequired);

// ─── GET all payments (with student name) ────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT p.payment_id, p.student_id, p.amount, p.fee_type, p.payment_method,
              p.reference_number, p.payment_date, p.status, p.paid_by,
              s.first_name, s.last_name, s.class_name
      FROM payments p
      LEFT JOIN students s ON s.student_id = p.student_id AND s.is_deleted = 0
      WHERE p.school_id = ? AND p.is_deleted = 0
      ORDER BY p.payment_date DESC, p.payment_id DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── GET fee structures ───────────────────────────────────────────────────────
router.get("/fee-structures", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT fee_structure_id, class_name, term, tuition, activity, misc
      FROM fee_structures WHERE school_id = ? AND is_deleted = 0
      ORDER BY class_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── POST fee structure ───────────────────────────────────────────────────────
router.post("/fee-structures", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, term = "Term 2", tuition = 0, activity = 0, misc = 0 } = req.body;
    if (!className) return res.status(400).json({ message: "className is required" });

    await pool.query(
      `INSERT INTO fee_structures (school_id, class_name, term, tuition, activity, misc)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE tuition=VALUES(tuition), activity=VALUES(activity), misc=VALUES(misc), updated_at=CURRENT_TIMESTAMP`,
      [schoolId, className, term, tuition, activity, misc]
    );
    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

// ─── POST record manual payment ──────────────────────────────────────────────
router.post("/", requireRoles("admin", "finance", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      studentId,
      amount,
      feeType      = "tuition",
      paymentMethod = "cash",
      referenceNumber = null,
      paymentDate,
      status       = "paid",
      term         = "Term 2",
      paidBy       = null,
    } = req.body;

    if (!studentId || !amount || !paymentDate)
      return res.status(400).json({ message: "studentId, amount and paymentDate are required" });

    const [result] = await pool.query(
      `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, term, paid_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, studentId, amount, feeType, paymentMethod, referenceNumber, paymentDate, status, term, paidBy]
    );

    // ── Email notification (fire-and-forget) ──
    if (isEmailConfigured()) {
      try {
        const [[student]] = await pool.query(
          `SELECT s.first_name, s.last_name, s.parent_name,
          u.email,
          COALESCE(SUM(i.amount_due),0) - COALESCE(SUM(p2.paid),0) AS balance
          FROM students s
          LEFT JOIN users u ON u.student_id = s.student_id AND u.role = 'parent' AND u.is_deleted = 0
          LEFT JOIN invoices i ON i.student_id = s.student_id AND i.school_id = s.school_id AND i.is_deleted = 0
          LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments WHERE school_id=? AND is_deleted=0 GROUP BY invoice_id) p2 ON p2.invoice_id = i.invoice_id
          WHERE s.student_id = ? AND s.school_id = ?
          GROUP BY s.student_id, u.email`, [schoolId, studentId, schoolId]
        );
        if (student?.email) {
          sendEmail({
            to: student.email,
            subject: `Payment Received — ${term}`,
            html: templates.paymentReceived({
              parentName:   student.parent_name || "Parent/Guardian",
              studentName:  `${student.first_name} ${student.last_name}`,
              amount, term, balance: student.balance,
            }),
            schoolId,
          }).catch(() => {});
        }
      } catch (_) {}
    }

    logActivity(req, { action:"payment.create", entity:"payment", entityId:result.insertId, description:`KES ${amount} recorded for student ${studentId}` });
    res.status(201).json({ paymentId: result.insertId });
  } catch (err) { next(err); }
});

// ─── PUT update payment ───────────────────────────────────────────────────────
router.put("/:id", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { amount, feeType, paymentMethod, referenceNumber, paymentDate, status, paidBy } = req.body;
    const [result] = await pool.query(
      `UPDATE payments SET amount=?, fee_type=?, payment_method=?, reference_number=?,
      payment_date=?, status=?, paid_by=?, updated_at=CURRENT_TIMESTAMP
      WHERE payment_id=? AND school_id=? AND is_deleted=0`,
      [amount, feeType, paymentMethod, referenceNumber||null, paymentDate, status||"paid", paidBy||null, req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Payment not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE payment ───────────────────────────────────────────────────────────
router.delete("/:id", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
      `UPDATE payments SET is_deleted=1, updated_at=CURRENT_TIMESTAMP
      WHERE payment_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Payment not found" });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;