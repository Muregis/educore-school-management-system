import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT student_id, admission_number, first_name, last_name, gender, class_id, status, date_of_birth, phone, email, created_at
       FROM students
       WHERE school_id = ? AND is_deleted = 0
       ORDER BY student_id DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT * FROM students WHERE student_id = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Student not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      admissionNumber, firstName, lastName, gender,
      classId = null, dateOfBirth = null, phone = null,
      email = null, address = null, admissionDate = null, status = "active"
    } = req.body;

    if (!admissionNumber || !firstName || !lastName || !gender) {
      return res.status(400).json({ message: "admissionNumber, firstName, lastName, gender are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO students (school_id, class_id, admission_number, first_name, last_name,
        gender, date_of_birth, phone, email, address, admission_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, classId, admissionNumber, firstName, lastName, gender, dateOfBirth, phone, email, address, admissionDate, status]
    );
    res.status(201).json({ studentId: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Admission number already exists for this school" });
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { firstName, lastName, gender, classId, dateOfBirth, phone, email, address, status } = req.body;
    const [result] = await pool.query(
      `UPDATE students SET first_name=?, last_name=?, gender=?, class_id=?, date_of_birth=?,
       phone=?, email=?, address=?, status=?, updated_at=CURRENT_TIMESTAMP
       WHERE student_id=? AND school_id=? AND is_deleted=0`,
      [firstName, lastName, gender, classId || null, dateOfBirth || null, phone || null,
       email || null, address || null, status || "active", req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Student not found" });
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
      `UPDATE students SET is_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE student_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Student not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;