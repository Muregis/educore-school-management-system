import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { logActivity } from "../helpers/activity.logger.js";
import { logAuthFailure } from "../helpers/security.logger.js";
import { generateSupabaseJWT } from "../helpers/supabase-jwt.js";

const router = Router();

function isPlaceholderHash(value) {
  return typeof value === "string" && value.includes("placeholder_");
}

function defaultPasswordForRole(role) {
  if (!role) return null;
  return `${role}123`;
}

// ── Staff login ───────────────────────────────────────────────────────────────
router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const { email, password, schoolId = 1 } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email and password are required" });

    const [users] = await pool.query(
      `SELECT user_id, full_name, email, password_hash, role, status
      FROM users
      WHERE email = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [email, schoolId]
    );
    if (!users.length) {
      // Log authentication failure
      logAuthFailure(req, { email, reason: "User not found", schoolId });
      
      if (process.env.NODE_ENV !== "production") {
        try {
          const [[{ c }]] = await pool.query(
            `SELECT COUNT(*) AS c FROM users WHERE is_deleted = 0`
          );
          if (Number(c) === 0) {
            return res.status(401).json({
              message: "No demo users found in DB. Run database/seed.sql, then try admin@greenfield.ac.ke / admin123.",
            });
          }
        } catch (_) { /* ignore */ }
      }
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];
    if (user.status !== "active") return res.status(403).json({ message: "Account inactive" });

    // Bcrypt first, plaintext fallback for legacy/dev accounts
    let valid = false;
    try { valid = await bcrypt.compare(password, user.password_hash); } catch { valid = false; }

    // Dev seed compatibility: placeholder hashes are not real bcrypt hashes.
    // If the user enters the conventional default password (e.g. admin123), accept and upgrade to bcrypt.
    if (!valid && process.env.NODE_ENV !== "production" && isPlaceholderHash(user.password_hash)) {
      const defaultPass = defaultPasswordForRole(user.role);
      if (defaultPass && password === defaultPass) {
        valid = true;
        try {
          const hash = await bcrypt.hash(password, 10);
          await pool.query(
            `UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
            [hash, user.user_id]
          );
        } catch (_) { /* ignore */ }
      }
    }
    if (!valid && user.password_hash === password) {
      valid = true;
      // Opportunistically upgrade plaintext password to bcrypt for future logins.
      try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
          `UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
          [hash, user.user_id]
        );
      } catch (_) { /* ignore */ }
    }
    if (!valid) {
      // Log authentication failure
      logAuthFailure(req, { email, reason: "Invalid password", schoolId });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const role = user.role;
    const name = user.full_name;
    // OLD:
    // const userPayload = { userId: user.user_id, schoolId: Number(schoolId), role, name, email: user.email };
    const userPayload = { user_id: user.user_id, school_id: Number(schoolId), role, name, email: user.email };

    const token = jwt.sign(
      userPayload,
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    // Generate Supabase-compatible JWT for RLS
    let supabaseToken = null;
    try {
      supabaseToken = generateSupabaseJWT(userPayload);
    } catch (error) {
      console.error("Failed to generate Supabase JWT:", error.message);
      // Continue without Supabase token for now
    }

    // Attach user to req so logActivity can read it
    req.user = userPayload;
    logActivity(req, { action: "auth.login", description: `${role} login: ${name}` });

    res.json({
      token,
      supabaseToken, // New Supabase JWT for frontend
      user: { userId: user.user_id, schoolId: Number(schoolId), role, name, email: user.email },
    });
  } catch (err) { next(err); }
});

// ── Portal login (parent / student) ──────────────────────────────────────────
router.post("/portal-login", authRateLimit, async (req, res, next) => {
  try {
    const { admissionNumber, password, schoolId = 1, role = "parent" } = req.body;
    if (!admissionNumber || !password)
      return res.status(400).json({ message: "admissionNumber and password are required" });

    // Find student
    const [students] = await pool.query(
      `SELECT student_id, first_name, last_name, school_id, admission_number
      FROM students
      WHERE admission_number = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
      [admissionNumber, schoolId]
    );
    if (!students.length) return res.status(401).json({ message: "Invalid admission number" });

    const student = students[0];

    // Find portal user
    const [users] = await pool.query(
      `SELECT user_id, full_name, email, password_hash, status
      FROM users
      WHERE school_id = ? AND student_id = ? AND role = ? AND is_deleted = 0 LIMIT 1`,
      [schoolId, student.student_id, role]
    );
    if (!users.length) return res.status(401).json({ message: "No portal account found. Contact admin." });

    const user = users[0];
    if (user.status !== "active") return res.status(403).json({ message: "Account inactive" });

    // Bcrypt first, plaintext fallback for legacy accounts
    let valid = false;
    try { valid = await bcrypt.compare(password, user.password_hash); } catch { valid = false; }

    // Dev seed compatibility: placeholder hashes are not real bcrypt hashes.
    if (!valid && process.env.NODE_ENV !== "production" && isPlaceholderHash(user.password_hash)) {
      const defaultPass = defaultPasswordForRole(role);
      if (defaultPass && password === defaultPass) {
        valid = true;
        try {
          const hash = await bcrypt.hash(password, 10);
          await pool.query(
            `UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`,
            [hash, user.user_id]
          );
        } catch (_) { /* ignore */ }
      }
    }
    if (!valid && user.password_hash === password) valid = true;
    if (!valid) return res.status(401).json({ message: "Invalid password" });

    const name = role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`;

    // OLD:
    // const userPayload = {
    //   userId: user.user_id, schoolId: student.school_id,
    //   role, name, studentId: student.student_id,
    //   admissionNumber: student.admission_number, email: user.email
    // };
    const userPayload = {
      user_id: user.user_id, school_id: student.school_id,
      role, name, student_id: student.student_id,
      admission_number: student.admission_number, email: user.email
    };

    const token = jwt.sign(
      userPayload,
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    // Generate Supabase-compatible JWT for RLS
    let supabaseToken = null;
    try {
      supabaseToken = generateSupabaseJWT(userPayload);
    } catch (error) {
      console.error("Failed to generate Supabase JWT:", error.message);
      // Continue without Supabase token for now
    }

    // Fee balance check (parents only)
    let feeBlocked = false;
    if (role === "parent") {
      try {
        const [[feeRow]] = await pool.query(
          `SELECT
            COALESCE(SUM(i.amount_due), 0)      AS total_due,
            COALESCE(SUM(p.amount_paid_sum), 0)  AS total_paid
          FROM invoices i
          LEFT JOIN (
            SELECT invoice_id, SUM(amount) AS amount_paid_sum
            FROM payments WHERE school_id = ? AND is_deleted = 0
            GROUP BY invoice_id
          ) p ON p.invoice_id = i.invoice_id
          WHERE i.school_id = ? AND i.student_id = ? AND i.is_deleted = 0`,
          [schoolId, schoolId, student.student_id]
        );
        const balance = Number(feeRow.total_due) - Number(feeRow.total_paid);
        feeBlocked = balance > 0;
      } catch (_) {}
    }

    // Log portal login
    req.user = { userId: user.user_id, schoolId: student.school_id, role, name };
    logActivity(req, { action: "auth.portal_login", description: `${role} login: ${name}` });

    res.json({
      token,
      supabaseToken, // New Supabase JWT for frontend
      feeBlocked,
      user: {
        userId: user.user_id, schoolId: student.school_id,
        role, name, email: user.email,
        studentId: student.student_id,
        admissionNumber: student.admission_number,
      },
    });
  } catch (err) { next(err); }
});

// ── /me ───────────────────────────────────────────────────────────────────────
router.get("/me", authRequired, (req, res) => res.json({ user: req.user }));

export default router;
