import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);
router.use(requireRoles("admin"));

// GET /api/accounts/users — list all portal users in this school (admin-only)
router.get("/users", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, phone, role, status, created_at
      FROM users
      WHERE school_id = ? AND is_deleted = 0
      ORDER BY role, full_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── STAFF ACCOUNTS ───────────────────────────────────────────────────────────

// GET /api/accounts/staff — list all staff (admin / teacher / finance)
router.get("/staff", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, phone, role, status, created_at
      FROM users
      WHERE school_id = ? AND role IN ('admin','teacher','finance') AND is_deleted = 0
      ORDER BY role, full_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/accounts/staff — create a new staff account
router.post("/staff", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, email, phone, role, password, status = "active" } = req.body;

    if (!name || !email || !password || !role)
      return res.status(400).json({ message: "name, email, password and role are required" });
    if (!["admin","teacher","finance"].includes(role))
      return res.status(400).json({ message: "role must be admin, teacher or finance" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (school_id, full_name, email, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, name, email, phone || null, hash, role, status]
    );
    res.status(201).json({ userId: result.insertId, message: "Staff account created" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "An account with this email already exists" });
    next(err);
  }
});

// PATCH /api/accounts/staff/:id — update name/email/phone/role/status or reset password
router.patch("/staff/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, email, phone, role, status, password } = req.body;

    if (password) {
      if (password.length < 6)
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP
        WHERE user_id=? AND school_id=? AND role IN ('admin','teacher','finance') AND is_deleted=0`,
        [hash, req.params.id, schoolId]
      );
    }

    // Update other fields if provided
    const fields = [];
    const vals   = [];
    if (name)   { fields.push("full_name=?");  vals.push(name); }
    if (email)  { fields.push("email=?");       vals.push(email); }
    if (phone !== undefined) { fields.push("phone=?"); vals.push(phone || null); }
    if (role && ["admin","teacher","finance"].includes(role)) { fields.push("role=?"); vals.push(role); }
    if (status && ["active","inactive"].includes(status)) { fields.push("status=?"); vals.push(status); }

    if (fields.length) {
      vals.push(req.params.id, schoolId);
      await pool.query(
        `UPDATE users SET ${fields.join(", ")}, updated_at=CURRENT_TIMESTAMP
        WHERE user_id=? AND school_id=? AND role IN ('admin','teacher','finance') AND is_deleted=0`,
        vals
      );
    }

    res.json({ updated: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Email already in use" });
    next(err);
  }
});

// DELETE /api/accounts/staff/:id — soft delete (cannot delete yourself)
router.delete("/staff/:id", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    if (String(req.params.id) === String(userId))
      return res.status(400).json({ message: "You cannot delete your own account" });

    const [result] = await pool.query(
      `UPDATE users SET is_deleted=1, updated_at=CURRENT_TIMESTAMP
      WHERE user_id=? AND school_id=? AND role IN ('admin','teacher','finance')`,
      [req.params.id, schoolId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Staff account not found" });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ─── PORTAL ACCOUNTS (parent / student) ──────────────────────────────────────

// GET /api/accounts/portal
router.get("/portal", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.role, u.status, u.student_id,
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

// POST /api/accounts/portal
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

    const [students] = await pool.query(
      `SELECT student_id, first_name, last_name, admission_number
      FROM students WHERE student_id=? AND school_id=? AND is_deleted=0 LIMIT 1`,
      [studentId, schoolId]
    );
    if (!students.length) return res.status(404).json({ message: "Student not found" });

    const student  = students[0];
    const fullName = name?.trim() || (role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`);
    const email    = `${student.admission_number.toLowerCase()}.${role}@portal`;
    const hash     = await bcrypt.hash(password, 10);

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

// PATCH /api/accounts/portal/:id
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
