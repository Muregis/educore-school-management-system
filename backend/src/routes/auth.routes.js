import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password, schoolId } = req.body;

    if (!email || !password || !schoolId) {
      return res.status(400).json({ message: "email, password and schoolId are required" });
    }

    const [rows] = await pool.query(
      `SELECT user_id, school_id, full_name, email, password_hash, role, status
       FROM users
       WHERE email = ? AND school_id = ? AND is_deleted = 0
       LIMIT 1`,
      [email, schoolId]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];
    if (user.status !== "active") {
      return res.status(403).json({ message: "User account is inactive" });
    }

    let isValid = false;
    if (user.password_hash?.startsWith("$2")) {
      isValid = await bcrypt.compare(password, user.password_hash);
    }

    // Dev fallback for seeded placeholder hashes.
    if (!isValid && String(user.password_hash).includes("placeholder") && password === "password123") {
      isValid = true;
    }

    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        schoolId: user.school_id,
        role: user.role,
        name: user.full_name,
        email: user.email
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({
      token,
      user: {
        userId: user.user_id,
        schoolId: user.school_id,
        role: user.role,
        name: user.full_name,
        email: user.email
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

export default router;
