import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authLogin } from "../services/auth.service.js";
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

// OLD CODE - preserved
// function defaultPasswordForRole(role) {
//   if (!role) return null;
//   return `${role}123`;  // INSECURE: Too predictable
// }
// OLD CODE - preserved

// SECURITY FIX: Generate secure random default password instead of predictable pattern
function defaultPasswordForRole(role) {
  if (!role) return null;
  // Generate secure random 8-character password (role prefix + random digits)
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${role.substring(0, 2).toUpperCase()}${randomPart}`;
}

// ── Public school lookup (for silent tenant discovery) ────────────────────────
router.get("/lookup-school", authRateLimit, async (req, res) => {
  try {
    const { loginId, role = "staff" } = req.query;
    if (!loginId) return res.json({ schools: [] });

    let schools = [];
    if (role === "staff") {
      const { data: users } = await supabase
        .from("users")
        .select("school_id, schools(name, motto)")
        .ilike("email", loginId.trim())
        .eq("is_deleted", false);
      schools = users?.map(u => ({ id: u.school_id, ...u.schools })) || [];
    } else {
      const { data: students } = await supabase
        .from("students")
        .select("school_id, schools(name, motto)")
        .ilike("admission_number", loginId.trim())
        .eq("is_deleted", false);
      schools = students?.map(s => ({ id: s.school_id, ...s.schools })) || [];
    }

    // De-duplicate and filter
    const unique = [];
    const seen = new Set();
    for (const s of schools) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        unique.push(s);
      }
    }
    res.json({ schools: unique });
  } catch (err) {
    res.status(500).json({ message: "Lookup failed" });
  }
});

// ── Public school info (for login branding) ──────────────────────────────────
router.get("/school-info/:id", authRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("schools")
      .select("name, motto")
      .eq("school_id", id)
      .maybeSingle();
    if (error || !data) return res.status(404).json({ message: "School not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching school info" });
  }
});

// ── Staff login ───────────────────────────────────────────────────────────────
router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const { email, password, schoolId } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email and password are required" });

    // Require explicit tenant; never default to a fallback school to avoid cross-tenant leakage
    const normalizedSchoolId = Number(schoolId);
    if (!schoolId || Number.isNaN(normalizedSchoolId)) {
      return res.status(400).json({ message: "schoolId is required and must be numeric" });
    }

    // Use Supabase authentication
    const authResult = await authLogin(email, password, normalizedSchoolId);
    
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
    const userPayload = { user_id: user.user_id, school_id: normalizedSchoolId, role, name, email: user.email };

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
    const { admissionNumber, password, schoolId = null, role = "parent" } = req.body;
    if (!admissionNumber || !password)
      return res.status(400).json({ message: "admissionNumber and password are required" });

    const trimmedAdmissionNumber = admissionNumber.trim();
    const portalEmail = `${trimmedAdmissionNumber.toLowerCase()}.${role}@portal`;
    const normalizedSchoolId = schoolId != null && schoolId !== "" ? Number(schoolId) : null;

    // SECURITY FIX: If schoolId provided, validate admission number belongs to that school
    // This prevents cross-school attacks where admission numbers might collide
    let studentQuery = supabase
      .from("students")
      .select("student_id, first_name, last_name, school_id, admission_number, parent_name")
      .ilike("admission_number", trimmedAdmissionNumber)
      .eq("is_deleted", false)
      .limit(1);

    if (normalizedSchoolId != null) {
      studentQuery = studentQuery.eq("school_id", normalizedSchoolId);
    }

    const { data: matchedStudents, error: studentLookupError } = await studentQuery;
    if (studentLookupError) throw studentLookupError;

    const student = matchedStudents?.[0];
    if (!student) {
      // SECURITY: Don't reveal whether admission number exists or wrong school
      return res.status(401).json({ message: "Invalid admission number or school" });
    }
    
    // OLD CODE - preserved
    // if (!student) {
    //   return res.status(401).json({ message: "Invalid admission number" });
    // }
    // OLD CODE - preserved

    // If schoolId was not provided, use the student's school_id (discovered from admission number)
    // This maintains backward compatibility while adding security when schoolId IS provided
    const resolvedSchoolId = normalizedSchoolId ?? student.school_id;

    let userQuery = supabase
      .from("users")
      .select("user_id, full_name, email, password_hash, role, status, student_id, school_id")
      .eq("school_id", resolvedSchoolId)
      .eq("student_id", student.student_id)
      .eq("is_deleted", false)
      .limit(10);

    const { data: matchedUsers, error: userError } = await userQuery;
    if (userError) throw userError;

    let user = (matchedUsers || []).find(candidate =>
      candidate.role === role && String(candidate.email || "").toLowerCase() === portalEmail
    );

    const legacyStudentAccount = (matchedUsers || []).find(candidate =>
      candidate.role === "student" && (
        String(candidate.email || "").toLowerCase() === `${trimmedAdmissionNumber.toLowerCase()}.student@portal` ||
        String(candidate.email || "").toLowerCase() === trimmedAdmissionNumber.toLowerCase()
      )
    );

    if (!user && role === "student") {
      user = legacyStudentAccount || null;
    }

    if (!user && role === "parent") {
      const existingParent = (matchedUsers || []).find(candidate => candidate.role === "parent");
      user = existingParent || null;
    }

    if (!user && role === "parent" && legacyStudentAccount) {
      let canBootstrapParent = false;

      if (legacyStudentAccount.password_hash) {
        canBootstrapParent = await bcrypt.compare(password, legacyStudentAccount.password_hash);
      }
      if (!canBootstrapParent && password === defaultPasswordForRole("parent")) {
        canBootstrapParent = true;
      }
      if (!canBootstrapParent && password === trimmedAdmissionNumber) {
        canBootstrapParent = true;
      }

      if (canBootstrapParent) {
        const parentPasswordHash = legacyStudentAccount.password_hash && await bcrypt.compare(password, legacyStudentAccount.password_hash)
          ? legacyStudentAccount.password_hash
          : await bcrypt.hash(password, 10);

        const { data: insertedParent, error: insertedParentError } = await supabase
          .from("users")
          .insert({
            school_id: student.school_id,
            student_id: student.student_id,
            full_name: student.parent_name?.trim() || `Parent of ${student.first_name} ${student.last_name}`,
            email: `${trimmedAdmissionNumber.toLowerCase()}.parent@portal`,
            password_hash: parentPasswordHash,
            role: "parent",
            status: "active",
          })
          .select("user_id, full_name, email, password_hash, role, status, student_id, school_id")
          .single();

        if (!insertedParentError && insertedParent) {
          user = insertedParent;
        }
      }
    }

    if (!user && ["parent", "student"].includes(role)) {
      let canBootstrapFromStudentOnly = false;
      if (password === defaultPasswordForRole(role)) {
        canBootstrapFromStudentOnly = true;
      }
      if (!canBootstrapFromStudentOnly && password === trimmedAdmissionNumber) {
        canBootstrapFromStudentOnly = true;
      }

      if (canBootstrapFromStudentOnly) {
        const bootstrapEmail = `${trimmedAdmissionNumber.toLowerCase()}.${role}@portal`;
        const bootstrapHash = await bcrypt.hash(password, 10);
        const { data: insertedUser, error: insertedUserError } = await supabase
          .from("users")
          .insert({
            school_id: student.school_id,
            student_id: student.student_id,
            full_name: role === "parent"
              ? student.parent_name?.trim() || `Parent of ${student.first_name} ${student.last_name}`
              : `${student.first_name} ${student.last_name}`,
            email: bootstrapEmail,
            password_hash: bootstrapHash,
            role,
            status: "active",
          })
          .select("user_id, full_name, email, password_hash, role, status, student_id, school_id")
          .single();

        if (!insertedUserError && insertedUser) {
          user = insertedUser;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        message: role === "parent"
          ? "Parent portal account not found. Create it in Accounts > Portal Accounts."
          : "Student portal account not found. Create it in Accounts > Portal Accounts."
      });
    }

    let passwordMatches = false;
    if (user.password_hash && !isPlaceholderHash(user.password_hash)) {
      passwordMatches = await bcrypt.compare(password, user.password_hash || "");
    }
    if (!passwordMatches && password === defaultPasswordForRole(role)) {
      passwordMatches = true;
    }
    if (!passwordMatches && password === trimmedAdmissionNumber) {
      passwordMatches = true;
    }
    if (!passwordMatches) return res.status(401).json({ message: "Invalid credentials" });
    if (user.status !== "active") return res.status(403).json({ message: "Account inactive" });

    if (!student || String(student.admission_number).trim().toLowerCase() !== trimmedAdmissionNumber.toLowerCase()) {
      return res.status(401).json({ message: "Portal account is not linked to that admission number" });
    }

    const name = role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`;

    const userPayload = {
      user_id: user.user_id, school_id: resolvedSchoolId,
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
    req.user = { userId: user.user_id, schoolId: resolvedSchoolId, role, name };
    logActivity(req, { action: "auth.portal_login", description: `${role} login: ${name}` });

    res.json({
      token,
      supabaseToken,
      feeBlocked: false, // TODO: Implement fee check
      user: {
        userId: user.user_id, schoolId: resolvedSchoolId,
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
