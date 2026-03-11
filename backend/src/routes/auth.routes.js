import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// ─── Staff login ─────────────────────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, schoolId } = req.body;
    if (!email || !password || !schoolId)
      return res.status(400).json({ message: "email, password and schoolId are required" });

    const [users] = await pool.query(
      `SELECT user_id, full_name, email, password_hash, role, status
      FROM users
      WHERE email = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [email, schoolId]
    );
    if (!users.length) return res.status(401).json({ message: "Invalid credentials" });

    const user = users[0];
    if (user.status !== "active") return res.status(403).json({ message: "Account inactive" });

    // Bug #8 fixed: removed plaintext "placeholder" password fallback.
    // Only bcrypt comparison is allowed now.
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      {
        userId:   user.user_id,
        schoolId: Number(schoolId),
        role:     user.role,
        name:     user.full_name,
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      token,
      user: {
        userId:   user.user_id,
        schoolId: Number(schoolId),
        role:     user.role,
        name:     user.full_name,
      },
    });
  } catch (err) { next(err); }
});

// ─── Portal login (parent / student — uses admission number) ─────────────────
router.post("/portal-login", async (req, res, next) => {
  try {
    const { admissionNumber, password, schoolId, role = "parent" } = req.body;
    if (!admissionNumber || !password || !schoolId)
      return res.status(400).json({ message: "admissionNumber, password and schoolId are required" });

    const [students] = await pool.query(
      `SELECT student_id, first_name, last_name, school_id, admission_number
      FROM students
      WHERE admission_number = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [admissionNumber, schoolId]
    );
    if (!students.length) return res.status(401).json({ message: "Invalid admission number" });

    const student = students[0];

    const [users] = await pool.query(
      `SELECT user_id, full_name, password_hash, status
      FROM users
      WHERE school_id = ? AND student_id = ? AND role = ? AND is_deleted = 0 LIMIT 1`,
      [schoolId, student.student_id, role]
    );
    if (!users.length) return res.status(401).json({ message: "No account found for this admission number" });

    const user = users[0];
    if (user.status !== "active") return res.status(403).json({ message: "Account inactive" });

    // Bug #8 fixed: removed plaintext fallback — bcrypt only
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid password" });

    const name = role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`;

    const token = jwt.sign(
      {
        userId:          user.user_id,
        schoolId:        student.school_id,
        role,
        name,
        studentId:       student.student_id,
        admissionNumber: student.admission_number,
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      token,
      user: {
        userId:          user.user_id,
        schoolId:        student.school_id,
        role,
        name,
        studentId:       student.student_id,
        admissionNumber: student.admission_number,
      },
    });
  } catch (err) { next(err); }
});

// ─── /me — return current user from token ────────────────────────────────────
router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

export default router;
