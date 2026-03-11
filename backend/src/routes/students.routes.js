import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// ─── GET list ────────────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT student_id, admission_number, first_name, last_name, gender,
              class_id, class_name, date_of_birth, phone, email, address,
              parent_name, parent_phone, admission_date, status, created_at
        FROM students
      WHERE school_id = ? AND is_deleted = 0
      ORDER BY student_id DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── GET single ──────────────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT * FROM students WHERE student_id = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Student not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─── POST create ─────────────────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      admissionNumber, firstName, lastName, gender,
      classId = null, className = null,
      dateOfBirth = null, phone = null, email = null,
      address = null, parentName = null, parentPhone = null,
      admissionDate = null, status = "active",
    } = req.body;

    if (!admissionNumber || !firstName || !lastName || !gender)
      return res.status(400).json({ message: "admissionNumber, firstName, lastName and gender are required" });

    // Resolve class_name from classId if not provided
    let resolvedClassName = className;
    if (!resolvedClassName && classId) {
      const [cls] = await pool.query(
        `SELECT class_name FROM classes WHERE class_id = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
        [classId, schoolId]
      );
      if (cls.length) resolvedClassName = cls[0].class_name;
    }

    const [result] = await pool.query(
      `INSERT INTO students
        (school_id, admission_number, first_name, last_name, gender, class_id, class_name,
          date_of_birth, phone, email, address, parent_name, parent_phone, admission_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, admissionNumber, firstName, lastName, gender,
      classId, resolvedClassName,
      dateOfBirth, phone, email, address, parentName, parentPhone, admissionDate, status]
    );
    res.status(201).json({ studentId: result.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Admission number already exists" });
    next(err);
  }
});

// ─── PUT update ──────────────────────────────────────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      firstName, lastName, gender,
      classId,              // may be null/undefined
      className,            // optional override
      dateOfBirth, phone, email, address,
      parentName, parentPhone,
      status,
    } = req.body;

    if (!firstName || !lastName)
      return res.status(400).json({ message: "firstName and lastName are required" });

    // Resolve class_name for the denormalised column
    let resolvedClassName = className ?? null;
    const resolvedClassId = classId != null ? Number(classId) : null;

    if (!resolvedClassName && resolvedClassId) {
      const [cls] = await pool.query(
        `SELECT class_name FROM classes WHERE class_id = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
        [resolvedClassId, schoolId]
      );
      if (cls.length) resolvedClassName = cls[0].class_name;
    }

    const [result] = await pool.query(
      `UPDATE students
      SET first_name=?, last_name=?, gender=?,
            class_id=?, class_name=?,
            date_of_birth=?, phone=?, email=?, address=?,
            parent_name=?, parent_phone=?,
            status=?, updated_at=CURRENT_TIMESTAMP
        WHERE student_id=? AND school_id=? AND is_deleted=0`,
      [
        firstName, lastName, gender,
        resolvedClassId, resolvedClassName,
        dateOfBirth || null, phone || null, email || null, address || null,
        parentName || null, parentPhone || null,
        status || "active",
        req.params.id, schoolId,
      ]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Student not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ─── DELETE soft delete ───────────────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [result] = await pool.query(
      `UPDATE students SET is_deleted=1, updated_at=CURRENT_TIMESTAMP
      WHERE student_id=? AND school_id=?`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Student not found" });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
