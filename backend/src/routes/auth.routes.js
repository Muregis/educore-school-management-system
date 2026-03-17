import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authLogin, migrateUserToSupabase } from "../services/hybrid-auth.js";
import { supabase } from "../config/supabaseClient.js";
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

    // Use Supabase authentication
    const authResult = await authLogin(email, password, schoolId);
    
    if (!authResult) {
      // Log authentication failure
      logAuthFailure(req, { email, reason: "User not found", schoolId });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { user } = authResult;
    console.log(`🔐 User authenticated:`, { email, userId: user.user_id });

    if (user.status !== "active") return res.status(403).json({ message: "Account inactive" });

    const role = user.role;
    const name = user.full_name;
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

    // Use Supabase for student lookup
    const { data: student, error } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, school_id, admission_number')
      .eq('admission_number', admissionNumber)
      .eq('is_deleted', false)
      .single();
    
    if (error || !student) {
      return res.status(401).json({ message: "Invalid admission number" });
    }

    // Find portal user using Supabase auth
    const authResult = await authLogin(
      role === "parent" ? `${admissionNumber}.parent@portal` : `${admissionNumber}.student@portal`,
      password,
      schoolId
    );
    
    if (!authResult) return res.status(401).json({ message: "No portal account found. Contact admin." });

    const user = authResult.user;
    if (user.status !== "active") return res.status(403).json({ message: "Account inactive" });

    const name = role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`;

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
    }

    // Log portal login
    req.user = { userId: user.user_id, schoolId: student.school_id, role, name };
    logActivity(req, { action: "auth.portal_login", description: `${role} login: ${name}` });

    res.json({
      token,
      supabaseToken,
      feeBlocked: false, // TODO: Implement fee check
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
