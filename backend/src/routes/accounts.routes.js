import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin"));

// GET /api/accounts/portal — list all parent/student portal accounts
router.get("/portal", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.role, u.status, u.student_id,
              s.first_name, s.last_name,
              CONCAT(s.first_name,' ',s.last_name) AS student_name,
              s.admission_number, s.class_name
       FROM users u
       LEFT JOIN students s ON s.student_id = u.student_id AND s.is_deleted = 0
       WHERE u.school_id = ? AND u.role IN ('parent','student') AND u.is_deleted = 0
       ORDER BY u.role, u.full_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/accounts/portal — create a parent or student portal account
router.post("/portal", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, role, password, name } = req.body;

    if (!studentId || !role || !password)
      return res.status(400).json({ message: "studentId, role and password are required" });
    if (!["parent","student"].includes(role))
      return res.status(400).json({ message: "Role must be parent or student" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    // Verify student belongs to this school
    const [students] = await pool.query(
      `SELECT student_id, first_name, last_name, admission_number
       FROM students WHERE student_id = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [studentId, schoolId]
    );
    if (!students.length)
      return res.status(404).json({ message: "Student not found" });

    const student  = students[0];
    const fullName = name?.trim() || (role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`);
    const email    = `${student.admission_number.toLowerCase()}.${role}@portal`;
    const hash     = await bcrypt.hash(password, 10);

    // Check if account already exists for this student + role
    const [existing] = await pool.query(
      `SELECT user_id FROM users WHERE school_id=? AND student_id=? AND role=? AND is_deleted=0 LIMIT 1`,
      [schoolId, studentId, role]
    );
    if (existing.length)
      return res.status(409).json({ message: `A ${role} account already exists for this student` });

    const [result] = await pool.query(
      `INSERT INTO users (school_id, student_id, full_name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [schoolId, studentId, fullName, email, hash, role]
    );
    res.status(201).json({ userId: result.insertId, message: "Account created" });
  } catch (err) { next(err); }
});

// PATCH /api/accounts/portal/:id — update status or reset password
router.patch("/portal/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, password } = req.body;

    if (password) {
      if (password.length < 6)
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP
         WHERE user_id=? AND school_id=? AND is_deleted=0`,
        [hash, req.params.id, schoolId]
      );
      return res.json({ updated: true });
    }

    if (status) {
      if (!["active","inactive"].includes(status))
        return res.status(400).json({ message: "status must be active or inactive" });
      await pool.query(
        `UPDATE users SET status=?, updated_at=CURRENT_TIMESTAMP
         WHERE user_id=? AND school_id=? AND is_deleted=0`,
        [status, req.params.id, schoolId]
      );
      return res.json({ updated: true });
    }

    res.status(400).json({ message: "Provide status or password to update" });
  } catch (err) { next(err); }
});

// DELETE /api/accounts/portal/:id
router.delete("/portal/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await pool.query(
      `UPDATE users SET is_deleted=1, updated_at=CURRENT_TIMESTAMP
       WHERE user_id=? AND school_id=? AND role IN ('parent','student')`,
      [req.params.id, schoolId]
    );
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;