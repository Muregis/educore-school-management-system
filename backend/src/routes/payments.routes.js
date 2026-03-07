import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT payment_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status
       FROM payments
       WHERE school_id = ? AND is_deleted = 0
       ORDER BY payment_date DESC, payment_id DESC`,
      [schoolId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      studentId,
      feeStructureId = null,
      amount,
      feeType = "tuition",
      paymentMethod = "cash",
      referenceNumber = null,
      paymentDate,
      status = "paid"
    } = req.body;

    if (!studentId || !amount || !paymentDate) {
      return res.status(400).json({ message: "studentId, amount, paymentDate are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO payments (school_id, student_id, fee_structure_id, amount, fee_type, payment_method, reference_number, payment_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, studentId, feeStructureId, amount, feeType, paymentMethod, referenceNumber, paymentDate, status]
    );

    res.status(201).json({ paymentId: result.insertId });
  } catch (err) {
    next(err);
  }
});

// update existing payment
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { amount, feeType, paymentMethod, referenceNumber, paymentDate, status } = req.body;
    const [result] = await pool.query(
      `UPDATE payments SET amount=?, fee_type=?, payment_method=?, reference_number=?, payment_date=?, status=?, updated_at=CURRENT_TIMESTAMP
       WHERE payment_id=? AND school_id=? AND is_deleted=0`,
      [amount, feeType, paymentMethod, referenceNumber || null, paymentDate, status || "paid", req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Payment not found" });
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// delete payment
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
      `UPDATE payments SET is_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE payment_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Payment not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
