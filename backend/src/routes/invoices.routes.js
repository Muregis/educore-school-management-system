import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// GET invoices
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    // OLD: const [rows] = await pool.query(
    // OLD:   `SELECT i.*, CONCAT(s.first_name,' ',s.last_name) AS student_name, s.class_name, s.admission_number
    // OLD:    FROM invoices i
    // OLD:    JOIN students s ON s.student_id = i.student_id
    // OLD:    WHERE i.school_id=? AND i.is_deleted=0
    // OLD:    ORDER BY i.created_at DESC`,
    // OLD:   [schoolId]
    // OLD: );
    const { data: rows } = await pool.query(
      `SELECT i.*, CONCAT(s.first_name,' ',s.last_name) AS student_name, s.class_name, s.admission_number
       FROM invoices i
       JOIN students s ON s.student_id = i.student_id
       WHERE i.school_id=? AND i.is_deleted=0
       ORDER BY i.created_at DESC`,
      [schoolId]
    );
    res.json(rows || []);
  } catch (err) { next(err); }
});

// POST generate invoice for student
router.post("/", requireRoles("admin","finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, term = "Term 2", academicYear = "2026", tuition = 0, activity = 0, misc = 0, transport = 0, dueDate } = req.body;
    if (!studentId) return res.status(400).json({ message: "studentId is required" });

    const invoiceNumber = `INV-${schoolId}-${studentId}-${Date.now()}`;
    const [result] = await pool.query(
      `INSERT INTO invoices (school_id, student_id, invoice_number, term, academic_year, tuition, activity, misc, transport, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, studentId, invoiceNumber, term, academicYear, tuition, activity, misc, transport, dueDate||null]
    );
    res.status(201).json({ invoiceId: result.insertId, invoiceNumber });
  } catch (err) { next(err); }
});

// POST bulk generate invoices for entire class
router.post("/bulk", requireRoles("admin","finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { className, term = "Term 2", academicYear = "2026", dueDate } = req.body;
    if (!className) return res.status(400).json({ message: "className is required" });

    // Get fee structure for class
    const [structs] = await pool.query(
      `SELECT tuition, activity, misc FROM fee_structures WHERE school_id=? AND class_name=? AND is_deleted=0 LIMIT 1`,
      [schoolId, className]
    );
    if (!structs.length) return res.status(404).json({ message: "No fee structure found for this class" });
    const { tuition, activity, misc } = structs[0];

    // Get all students in class
    const [students] = await pool.query(
      `SELECT student_id FROM students WHERE school_id=? AND class_name=? AND is_deleted=0`,
      [schoolId, className]
    );
    if (!students.length) return res.status(404).json({ message: "No students found in this class" });

    let created = 0;
    for (const s of students) {
      const invoiceNumber = `INV-${schoolId}-${s.student_id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      try {
        await pool.query(
          `INSERT INTO invoices (school_id, student_id, invoice_number, term, academic_year, tuition, activity, misc, due_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [schoolId, s.student_id, invoiceNumber, term, academicYear, tuition, activity, misc, dueDate||null]
        );
        created++;
      } catch { /* skip duplicates */ }
    }
    res.json({ created, total: students.length });
  } catch (err) { next(err); }
});

// PATCH update invoice status
router.patch("/:id", requireRoles("admin","finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.body;
    await pool.query(
      `UPDATE invoices SET status=?, updated_at=CURRENT_TIMESTAMP WHERE invoice_id=? AND school_id=?`,
      [status, req.params.id, schoolId]
    );
    res.json({ updated: true });
  } catch (err) { next(err); }
});

export default router;
