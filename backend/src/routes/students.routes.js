import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { pgPool } from "../config/pg.js";
import { authRequired } from "../middleware/auth.js";
import { logActivity } from "../helpers/activity.logger.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

const usePgStudentsGet =
  String(process.env.USE_PG_STUDENTS_GET || "").toLowerCase() === "true";

// Always return class_name so frontend normalise() works
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    if (usePgStudentsGet) {
      const { rows } = await pgPool.query(
        `SELECT s.student_id, s.admission_number, s.first_name, s.last_name,
                s.gender, s.class_id, s.class_name, s.status, s.date_of_birth,
                s.phone, s.email, s.parent_name, s.parent_phone, s.admission_date, s.created_at
        FROM students s
        WHERE s.school_id=$1 AND s.is_deleted=false
        ORDER BY s.class_name, s.first_name`,
        [schoolId]
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      `SELECT s.student_id, s.admission_number, s.first_name, s.last_name,
              s.gender, s.class_id, s.class_name, s.status, s.date_of_birth,
              s.phone, s.email, s.parent_name, s.parent_phone, s.admission_date, s.created_at
      FROM students s
      WHERE s.school_id=? AND s.is_deleted=0
      ORDER BY s.class_name, s.first_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT * FROM students WHERE student_id=? AND school_id=? AND is_deleted=0 LIMIT 1`,
      [req.params.id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ message: "Student not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post("/", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      admissionNumber, firstName, lastName, gender, className,
      classId = null, dateOfBirth = null, phone = null, parentName = null,
      parentPhone = null, email = null, address = null,
      admissionDate = null, status = "active"
    } = req.body;

    if (!admissionNumber || !firstName || !lastName || !gender)
      return res.status(400).json({ message: "admissionNumber, firstName, lastName, gender are required" });

    // Resolve classId from className if not provided
    let resolvedClassId = classId;
    let resolvedClassName = className || null;
    if (className && !classId) {
      const [cls] = await pool.query(
        `SELECT class_id FROM classes WHERE school_id=? AND class_name=? LIMIT 1`,
        [schoolId, className]
      );
      if (cls.length) resolvedClassId = cls[0].class_id;
    }

    const [result] = await pool.query(
      `INSERT INTO students (school_id, class_id, class_name, admission_number, first_name, last_name,
        gender, date_of_birth, phone, email, address, parent_name, parent_phone, admission_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, resolvedClassId, resolvedClassName, admissionNumber, firstName, lastName,
      gender, dateOfBirth, phone, email, address, parentName, parentPhone,
      admissionDate || new Date().toISOString().slice(0,10), status]
    );

    // Auto-create student portal account (login: admissionNumber, pass: admissionNumber)
    try {
      const hash = await bcrypt.hash(admissionNumber, 10);
      await pool.query(
        `INSERT IGNORE INTO users (school_id, student_id, full_name, email, password_hash, role, status)
        VALUES (?, ?, ?, ?, ?, 'student', 'active')`,
        [schoolId, result.insertId, `${firstName} ${lastName}`, admissionNumber, hash]
      );
    } catch { /* ignore if account already exists */ }

    // Return the full new student row so frontend can update state correctly
    const [newRow] = await pool.query(
      `SELECT * FROM students WHERE student_id=? LIMIT 1`,
      [result.insertId]
    );
    logActivity(req, { action:"student.create", entity:"student", entityId:result.insertId, description:`Student admitted: ${req.body.firstName} ${req.body.lastName}` });
    res.status(201).json(newRow[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Admission number already exists" });
    next(err);
  }
});

router.put("/:id", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      firstName, lastName, gender, className, classId,
      dateOfBirth, phone, parentName, parentPhone, email, address, status
    } = req.body;

    let resolvedClassId = classId || null;
    if (className && !classId) {
      const [cls] = await pool.query(
        `SELECT class_id FROM classes WHERE school_id=? AND class_name=? LIMIT 1`,
        [schoolId, className]
      );
      if (cls.length) resolvedClassId = cls[0].class_id;
    }

    const [result] = await pool.query(
      `UPDATE students SET first_name=?, last_name=?, gender=?, class_id=?, class_name=?,
      date_of_birth=?, phone=?, email=?, address=?, parent_name=?, parent_phone=?,
      status=?, updated_at=CURRENT_TIMESTAMP
      WHERE student_id=? AND school_id=? AND is_deleted=0`,
      [firstName, lastName, gender, resolvedClassId, className||null,
      dateOfBirth||null, phone||null, email||null, address||null,
      parentName||null, parentPhone||null, status||"active",
      req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Student not found" });
    res.json({ updated: true });
  } catch (err) { next(err); }
});

router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
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
