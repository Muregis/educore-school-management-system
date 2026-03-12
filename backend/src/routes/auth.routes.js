import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// ─── Staff login (email + password) ──────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, schoolId = 1 } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email and password are required" });

    const [users] = await pool.query(
      `SELECT user_id, full_name, email, password_hash, role, status
       FROM users WHERE email = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [email, schoolId]
    );
    if (!users.length) return res.status(401).json({ message: "Invalid credentials" });

    const user = users[0];
    if (user.status !== "active") return res.status(403).json({ message: "Account inactive" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.user_id, schoolId: Number(schoolId), role: user.role, name: user.full_name },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      token,
      user: { userId: user.user_id, schoolId: Number(schoolId), role: user.role, name: user.full_name },
    });
  } catch (err) { next(err); }
});

// ─── Portal login (parent / student — admission number) ───────────────────────
router.post("/portal-login", async (req, res, next) => {
  try {
    const { admissionNumber, password, schoolId = 1, role = "parent" } = req.body;
    if (!admissionNumber || !password)
      return res.status(400).json({ message: "admissionNumber and password are required" });
    if (!["parent","student"].includes(role))
      return res.status(400).json({ message: "role must be parent or student" });

    // Find the student by admission number
    const [students] = await pool.query(
      `SELECT student_id, first_name, last_name, school_id, admission_number
       FROM students WHERE admission_number = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [admissionNumber, schoolId]
    );
    if (!students.length) return res.status(401).json({ message: "Invalid admission number" });

    const student = students[0];

    // Find portal user linked to this student
    const [portalUsers] = await pool.query(
      `SELECT user_id, full_name, password_hash, status
       FROM users WHERE school_id = ? AND student_id = ? AND role = ? AND is_deleted = 0 LIMIT 1`,
      [schoolId, student.student_id, role]
    );

    if (!portalUsers.length) {
      // Auto-create portal account if missing (safety net)
      const hash = await bcrypt.hash(admissionNumber, 10);
      const name = role === "parent"
        ? `Parent of ${student.first_name} ${student.last_name}`
        : `${student.first_name} ${student.last_name}`;
      const [ins] = await pool.query(
        `INSERT INTO users (school_id, student_id, full_name, email, password_hash, role, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [schoolId, student.student_id, name, `${admissionNumber}.${role}@portal.local`, hash, role]
      );
      const token = jwt.sign(
        { userId: ins.insertId, schoolId: student.school_id, role, name, studentId: student.student_id, admissionNumber: student.admission_number },
        env.jwtSecret, { expiresIn: env.jwtExpiresIn }
      );
      // Check if the provided password matches the admission number (default)
      if (password !== admissionNumber) {
        // Try bcrypt anyway in case they set a custom password
        return res.status(401).json({ message: "Invalid password. Default password is your admission number." });
      }
      return res.json({ token, user: { userId: ins.insertId, schoolId: student.school_id, role, name, studentId: student.student_id, admissionNumber: student.admission_number } });
    }

    const portalUser = portalUsers[0];
    if (portalUser.status !== "active") return res.status(403).json({ message: "Account inactive" });

    // Try bcrypt first
    let valid = await bcrypt.compare(password, portalUser.password_hash);

    // Fallback: if hash looks like plaintext (not bcrypt), check directly and re-hash
    if (!valid && !portalUser.password_hash.startsWith("$2")) {
      if (password === portalUser.password_hash) {
        valid = true;
        // Re-hash the password properly
        const newHash = await bcrypt.hash(password, 10);
        await pool.query(`UPDATE users SET password_hash=? WHERE user_id=?`, [newHash, portalUser.user_id]);
      }
    }

    // Also accept admission number as password if the hash was set to admission number
    if (!valid) {
      valid = await bcrypt.compare(admissionNumber, portalUser.password_hash);
      if (valid && password !== admissionNumber) valid = false;
      else if (!valid) {
        // Last resort: maybe password_hash IS the admission number stored as plaintext
        if (portalUser.password_hash === admissionNumber && password === admissionNumber) {
          valid = true;
          const newHash = await bcrypt.hash(password, 10);
          await pool.query(`UPDATE users SET password_hash=? WHERE user_id=?`, [newHash, portalUser.user_id]);
        }
      }
    }

    if (!valid) return res.status(401).json({ message: "Invalid password" });

    const name = role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`;

    const token = jwt.sign(
      { userId: portalUser.user_id, schoolId: student.school_id, role, name, studentId: student.student_id, admissionNumber: student.admission_number },
      env.jwtSecret, { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      token,
      user: { userId: portalUser.user_id, schoolId: student.school_id, role, name, studentId: student.student_id, admissionNumber: student.admission_number },
    });
  } catch (err) { next(err); }
});

// ─── /me ─────────────────────────────────────────────────────────────────────
router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

export default router;