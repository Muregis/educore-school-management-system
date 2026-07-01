import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authLogin } from "../services/auth.service.js";
import { supabase } from "../config/supabaseClient.js";
import { env } from "../config/env.js";
import { authRequired } from "../middleware/auth.js";
import { validateSession, createUserSession, revokeUserSession } from "../middleware/session.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { logActivity } from "../helpers/activity.logger.js";
import { logAuthFailure } from "../helpers/security.logger.js";
import { generateSupabaseJWT } from "../helpers/supabase-jwt.js";
import { logTenantContext, logTenantQuery } from "../helpers/tenant-debug.logger.js";
import { requireRoles, requireDirector } from "../middleware/roles.js";
import { pgPool } from "../config/pg.js";
import { generateTwoFactorSecret, generateBackupCodes, verifyTwoFactorToken } from "../middleware/twoFactor.js";

const router = Router();

const DEFAULT_SCHOOL_BRANDING = {
  school_id: null,
  name: "EduCore",
  tagline: "Student & Parent Portal",
  motto: "Student & Parent Portal",
  location: "Multi-school platform",
  established_year: null,
  logo_url: null,
  primary_color: "#C9A84C",
  secondary_color: "#3B82F6",
  hero_message: "Access grades, fees, attendance, and school updates from one secure portal.",
  code: null,
  notFound: true,
};

function isPlaceholderHash(value) {
  return typeof value === "string" && value.includes("placeholder_");
}

function defaultPasswordForRole(role) {
  if (!role) return null;
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${role.substring(0, 2).toUpperCase()}${randomPart}`;
}

function slugifySchoolName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getHostSubdomain(hostname) {
  const host = String(hostname || "").trim().toLowerCase().split(":")[0];
  if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 3) return null;
  return parts[0];
}

async function getSchoolSettingsMap(schoolId) {
  const { data, error } = await supabase
    .from("school_settings")
    .select("setting_key, setting_value")
    .eq("school_id", schoolId);

  if (error && error.code !== "PGRST205") throw error;
  return new Map((data || []).map(item => [item.setting_key, item.setting_value]));
}

async function findSchoolById(schoolId) {
  if (!schoolId) return null;
  const { data, error } = await supabase
    .from("schools")
    .select("school_id, name, code, email, phone, address, county, country")
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function buildSchoolBranding(baseSchool) {
  if (!baseSchool) return { ...DEFAULT_SCHOOL_BRANDING };

  const settings = await getSchoolSettingsMap(baseSchool.school_id);
  const tagline =
    settings.get("school_tagline") ||
    settings.get("school_motto") ||
    settings.get("tagline") ||
    DEFAULT_SCHOOL_BRANDING.tagline;

  return {
    school_id: baseSchool.school_id,
    name: baseSchool.name || DEFAULT_SCHOOL_BRANDING.name,
    tagline,
    motto: tagline,
    location: [baseSchool.county, baseSchool.country].filter(Boolean).join(", ") || DEFAULT_SCHOOL_BRANDING.location,
    established_year: settings.get("established_year") || null,
    logo_url: settings.get("school_logo") || settings.get("logo_url") || null,
    primary_color: settings.get("primary_color") || DEFAULT_SCHOOL_BRANDING.primary_color,
    secondary_color: settings.get("secondary_color") || DEFAULT_SCHOOL_BRANDING.secondary_color,
    hero_message: settings.get("hero_message") || `Welcome to ${baseSchool.name}. Sign in to continue.`,
    code: baseSchool.code || null,
    email: baseSchool.email || null,
    phone: baseSchool.phone || null,
    address: baseSchool.address || null,
    county: baseSchool.county || null,
    country: baseSchool.country || "Kenya",
    notFound: false,
  };
}

async function resolveSchoolCandidates({ loginId, role = "staff" }) {
  if (!loginId) return [];

  const trimmedLoginId = String(loginId).trim();
  let schools = [];

  try {
    if (role === "staff") {
      const { data: users, error } = await supabase
        .from("users")
        .select("school_id, schools:school_id(school_id, name, code, email, phone, address, county, country)")
        .ilike("email", trimmedLoginId)
        .eq("is_deleted", false);
      if (error) throw error;
      schools = users?.map(user => user.schools).filter(Boolean) || [];
    } else {
      const { data: students, error } = await supabase
        .from("students")
        .select("school_id, schools:school_id(school_id, name, code, email, phone, address, county, country)")
        .ilike("admission_number", trimmedLoginId)
        .eq("is_deleted", false);
      if (error) throw error;
      schools = students?.map(student => student.schools).filter(Boolean) || [];
    }

    const uniqueSchools = [];
    const seen = new Set();
    for (const school of schools) {
      if (school?.school_id && !seen.has(school.school_id)) {
        seen.add(school.school_id);
        try {
          const schoolBranding = await buildSchoolBranding(school);
          uniqueSchools.push(schoolBranding);
        } catch (brandingError) {
          console.error("Failed to build school branding:", brandingError);
          // Still add the school even if branding fails
          uniqueSchools.push({
            school_id: school.school_id,
            name: school.name || "Unknown School",
            tagline: DEFAULT_SCHOOL_BRANDING.tagline,
            location: DEFAULT_SCHOOL_BRANDING.location,
            primary_color: DEFAULT_SCHOOL_BRANDING.primary_color,
            secondary_color: DEFAULT_SCHOOL_BRANDING.secondary_color,
            notFound: false,
          });
        }
      }
    }

    return uniqueSchools;
  } catch (error) {
    console.error("Error resolving school candidates:", error);
    return [];
  }
}

router.get("/lookup-school", authRateLimit, async (req, res) => {
  try {
    const { loginId, role = "staff" } = req.query;
    if (!loginId) return res.json({ schools: [] });

    const schools = await resolveSchoolCandidates({ loginId, role });
    res.json({ schools });
  } catch (_err) {
    res.status(500).json({ message: "Lookup failed" });
  }
});

router.get("/resolve-school", authRateLimit, async (req, res) => {
  try {
    const { hostname = "", loginId = "", selectedSchoolId = "", role = "staff" } = req.query;
    const numericSchoolId = selectedSchoolId ? Number(selectedSchoolId) : null;

    // Validate selected school ID if provided
    if (numericSchoolId && !Number.isNaN(numericSchoolId) && loginId) {
      try {
        // Validate that the user actually belongs to the selected school
        const userSchools = await resolveSchoolCandidates({ loginId, role });
        const userSchoolIds = userSchools.map(school => school.school_id);
        
        if (userSchoolIds.includes(numericSchoolId)) {
          const matchedSchool = await findSchoolById(numericSchoolId);
          if (matchedSchool) {
            return res.json(await buildSchoolBranding(matchedSchool));
          }
        }
      } catch (validationError) {
        console.error("Error validating school selection:", validationError);
        // Continue with normal flow if validation fails
      }
    }

    // Try subdomain-based resolution first
    const subdomain = getHostSubdomain(hostname);
    if (subdomain) {
      try {
        const { data: schools, error } = await supabase
          .from("schools")
          .select("school_id, name, code, email, phone, address, county, country")
          .eq("is_deleted", false);
        if (error) throw error;

        const matchedSchool = (schools || []).find(school =>
          String(school.code || "").toLowerCase() === subdomain ||
          slugifySchoolName(school.name) === subdomain
        );

        if (matchedSchool) {
          return res.json(await buildSchoolBranding(matchedSchool));
        }
      } catch (subdomainError) {
        console.error("Error resolving school by subdomain:", subdomainError);
        // Continue with other resolution methods
      }
    }

    // Try login-based resolution
    if (loginId) {
      try {
        const schools = await resolveSchoolCandidates({ loginId, role });
        if (schools.length === 1) {
          return res.json(schools[0]);
        }
        if (schools.length > 1) {
          return res.json({ 
            ...DEFAULT_SCHOOL_BRANDING, 
            schoolOptions: schools, 
            ambiguous: true 
          });
        }
      } catch (loginError) {
        console.error("Error resolving schools by login:", loginError);
        // Continue to default response
      }
    }

    // Return default branding if no school found
    return res.json({ ...DEFAULT_SCHOOL_BRANDING });
  } catch (error) {
    console.error("Error in resolve-school endpoint:", error);
    return res.status(500).json({ message: "Error resolving school branding" });
  }
});

router.get("/school-info/:id", authRateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const school = await findSchoolById(id);
    if (!school) return res.json({ ...DEFAULT_SCHOOL_BRANDING });
    res.json(await buildSchoolBranding(school));
  } catch (_err) {
    res.status(500).json({ message: "Error fetching school info" });
  }
});

// Diagnostic route to check current session context
router.get("/me", authRequired, validateSession, (req, res) => {
  res.json({
    user: req.user,
    timestamp: new Date().toISOString(),
    headers: {
      'x-school-id': req.headers['x-school-id'],
      'x-effective-school-id': req.headers['x-effective-school-id']
    }
  });
});

const SUPERADMIN_EMAIL = env.superadminEmail || "muregivictor@gmail.com";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

async function logSecurityEvent(schoolId, userId, eventType, req, details = {}) {
  try {
    await pgPool.query(
      `INSERT INTO security_logs (school_id, user_id, event_type, ip_address, user_agent, details, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        schoolId || 0,
        userId || null,
        eventType,
        req.ip,
        req.get("User-Agent") || null,
        JSON.stringify(details),
        details.severity || "info"
      ]
    );
  } catch (err) {
    console.error("[security] Failed to log security event:", err.message);
  }
}

async function checkAccountLockout(schoolId, email) {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("user_id, failed_login_attempts, locked_until, email")
      .eq("school_id", schoolId)
      .ilike("email", email)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!user) return { locked: false, userId: null };

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return { locked: true, userId: user.user_id, lockedUntil: user.locked_until };
    }

    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      await supabase
        .from("users")
        .update({ failed_login_attempts: 0, locked_until: null })
        .eq("user_id", user.user_id);
    }

    return { locked: false, userId: user.user_id };
  } catch (err) {
    console.error("[security] Lockout check failed:", err);
    return { locked: false, userId: null };
  }
}

async function incrementFailedLogin(schoolId, email, req) {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("user_id, failed_login_attempts, email")
      .eq("school_id", schoolId)
      .ilike("email", email)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!user) return;

    const attempts = (user.failed_login_attempts || 0) + 1;
    const updates = { failed_login_attempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
      updates.locked_until = lockedUntil;
      await logSecurityEvent(schoolId, user.user_id, "account_locked", req, {
        reason: "Too many failed login attempts",
        attempts
      });
    } else {
      await logSecurityEvent(schoolId, user.user_id, "login_failed", req, {
        reason: "Invalid credentials",
        attempts,
        remaining: MAX_FAILED_ATTEMPTS - attempts
      });
    }

    await supabase
      .from("users")
      .update(updates)
      .eq("user_id", user.user_id);
  } catch (err) {
    console.error("[security] Failed to increment failed login:", err);
  }
}

async function resetFailedLogin(schoolId, userId) {
  try {
    await supabase
      .from("users")
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq("school_id", schoolId)
      .eq("user_id", userId);
  } catch (err) {
    console.error("[security] Failed to reset failed login:", err);
  }
}

// Helper to verify superadmin password (stored in env or hardcoded for now)
async function verifySuperadminPassword(password) {
  // For now, use a hash of a default superadmin password
  // In production, this should be in environment variables
  const SUPERADMIN_PASSWORD_HASH = "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"; // "superadmin123"
  return await bcrypt.compare(password, SUPERADMIN_PASSWORD_HASH);
}

router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const { email, password, schoolId } = req.body;
    logTenantContext("auth.login.request", req, { email, schoolId });
    
    // Enhanced validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    
    if (!email.includes('@') || email.length < 5) {
      return res.status(400).json({ message: "Valid email address is required" });
    }
    
    if (password.length < 1) {
      return res.status(400).json({ message: "Password is required" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check for superadmin login
    if (trimmedEmail === SUPERADMIN_EMAIL) {
      const isValidSuperadmin = await verifySuperadminPassword(password);
      if (!isValidSuperadmin) {
        logAuthFailure(req, { email, reason: "Invalid superadmin credentials" });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate superadmin token
      const userPayload = { 
        user_id: "superadmin", 
        school_id: null, 
        role: "superadmin", 
        name: "Super Administrator", 
        email: SUPERADMIN_EMAIL 
      };
      const token = jwt.sign(userPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

      logActivity(req, { action: "auth.superadmin_login", description: "Superadmin login" });
      const sessionId = await createUserSession(req, userPayload.user_id);

      return res.json({
        token,
        sessionId,
        supabaseToken: null,
        user: { 
          userId: "superadmin", 
          schoolId: null, 
          role: "superadmin", 
          name: "Super Administrator", 
          email: SUPERADMIN_EMAIL 
        },
      });
    }

    let normalizedSchoolId = schoolId != null && schoolId !== "" ? Number(schoolId) : null;
    if (normalizedSchoolId != null && Number.isNaN(normalizedSchoolId)) {
      return res.status(400).json({ message: "School ID must be numeric when provided" });
    }

    if (normalizedSchoolId == null) {
      const { data: candidates, error } = await supabase
        .from("users")
        .select("school_id")
        .ilike("email", trimmedEmail)
        .eq("is_deleted", false);
      logTenantQuery("auth.login.school_lookup", { table: "users", email, schoolId: null });
      if (error) throw error;

      const unique = Array.from(new Set((candidates || []).map(user => user.school_id)));
      if (unique.length === 0) {
        return res.status(404).json({ message: "We couldn't find your school for that email. Please enter the school ID or contact admin." });
      }
      if (unique.length > 1) {
        return res.status(400).json({ 
          message: "Multiple schools matched this email. Please choose your school ID to continue.", 
          schoolOptions: unique 
        });
      }
      normalizedSchoolId = unique[0];
    }

    const authResult = await authLogin(email, password, normalizedSchoolId);
    if (!authResult) {
      await incrementFailedLogin(normalizedSchoolId, trimmedEmail, req);
      logAuthFailure(req, { email, reason: "User not found or invalid credentials", schoolId: normalizedSchoolId });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { user } = authResult;
    if (user.status !== "active") {
      await incrementFailedLogin(normalizedSchoolId, trimmedEmail, req);
      logAuthFailure(req, { email, reason: "Account inactive", schoolId: normalizedSchoolId });
      return res.status(403).json({ message: "Account inactive" });
    }

    // Check if account is locked
    const lockoutStatus = await checkAccountLockout(normalizedSchoolId, trimmedEmail);
    if (lockoutStatus.locked) {
      logAuthFailure(req, { email, reason: "Account locked", userId: lockoutStatus.userId, schoolId: normalizedSchoolId });
      return res.status(423).json({ 
        message: "Account temporarily locked. Please try again later.",
        lockedUntil: lockoutStatus.lockedUntil 
      });
    }

    // Check if 2FA is required
    if (user.two_factor_enabled) {
      const tempToken = jwt.sign(
        { user_id: user.user_id, school_id: normalizedSchoolId, role: user.role, two_factor_pending: true },
        env.jwtSecret,
        { expiresIn: "5m" }
      );
      const tempSessionId = await createUserSession(req, user.user_id);
      await logSecurityEvent(normalizedSchoolId, user.user_id, "login_2fa_required", req, { email: user.email });
      return res.json({
        twoFactorRequired: true,
        tempToken,
        tempSessionId,
        message: "Two-factor authentication required"
      });
    }

    const role = user.role;
    const name = user.full_name;
    const userPayload = { user_id: user.user_id, school_id: normalizedSchoolId, role, name, email: user.email };
    const token = jwt.sign(userPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

    let supabaseToken = null;
    try {
      supabaseToken = generateSupabaseJWT(userPayload);
    } catch (error) {
      console.error("Failed to generate Supabase JWT:", error.message);
    }

    // Fetch school with branch info
    const { data: schoolData, error: schoolError } = await supabase
      .from("schools")
      .select("plan, plan_expires_at, is_branch, parent_school_id, branch_code")
      .eq("school_id", normalizedSchoolId)
      .single();
      
    if (schoolError && schoolError.code !== 'PGRST116') {
      console.error("School data fetch error:", schoolError);
    }

    let schoolPlan = schoolData?.plan || "starter";

    // Check if plan has expired
    if (schoolData?.plan_expires_at) {
      const expiresAt = new Date(schoolData.plan_expires_at);
      const now = new Date();
      if (expiresAt < now && schoolPlan !== 'starter') {
        try {
          await supabase
            .from('schools')
            .update({ plan: 'starter' })
            .eq('school_id', normalizedSchoolId);
        } catch (updateError) {
          console.error("Failed to update expired plan:", updateError);
        }
        schoolPlan = 'starter';
      }
    }

    req.user = userPayload;
    logActivity(req, { action: "auth.login", description: `${role} login: ${name}` });
    await resetFailedLogin(normalizedSchoolId, user.user_id);
    await logSecurityEvent(normalizedSchoolId, user.user_id, "login_success", req, { email: user.email, role });
    const sessionId = await createUserSession(req, user.user_id);

    // Hide branch info from parents/students
    const isParentOrStudent = role === "parent" || role === "student";
    
    res.json({
      token,
      sessionId,
      supabaseToken,
      user: { 
        userId: user.user_id, 
        schoolId: normalizedSchoolId, 
        role, 
        name, 
        email: user.email, 
        plan: schoolPlan,
        isBranch: isParentOrStudent ? false : (schoolData?.is_branch || false),
        parentSchoolId: isParentOrStudent ? null : (schoolData?.parent_school_id || null),
        branchCode: isParentOrStudent ? null : (schoolData?.branch_code || null)
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    next(err);
  }
});

router.post("/portal-login", authRateLimit, async (req, res, next) => {
  try {
    const { admissionNumber, password, schoolId = null, schoolCode: providedSchoolCode = null, role = "parent" } = req.body;
    logTenantContext("auth.portal_login.request", req, { admissionNumber, schoolId, schoolCode: providedSchoolCode, role });
    
    // Enhanced validation
    if (!admissionNumber || !password) {
      return res.status(400).json({ message: "Admission number and password are required" });
    }
    
    if (admissionNumber.trim().length < 2) {
      return res.status(400).json({ message: "Valid admission number is required" });
    }
    
    if (password.length < 1) {
      return res.status(400).json({ message: "Password is required" });
    }
    
    if (!["parent", "student"].includes(role)) {
      return res.status(400).json({ message: "Role must be either 'parent' or 'student'" });
    }

    const trimmedAdmissionNumber = admissionNumber.trim().toLowerCase();
    const normalizedSchoolId = schoolId != null && schoolId !== "" ? Number(schoolId) : null;
    
    // Validate school identification is provided
    if (!normalizedSchoolId && !providedSchoolCode) {
      // Check if admission number exists in multiple schools
      const { data: schoolsCheck, error: checkError } = await supabase
        .from("students")
        .select("school_id, schools!inner(code, name)")
        .ilike("admission_number", trimmedAdmissionNumber)
        .eq("is_deleted", false);
      
      if (checkError) throw checkError;
      
      if (schoolsCheck && schoolsCheck.length > 1) {
        return res.status(400).json({
          message: "This admission number exists in multiple schools. Please provide your school code.",
          schools: schoolsCheck.map(s => ({ code: s.schools.code, name: s.schools.name })),
          requireSchoolCode: true
        });
      }
    }
    
    if (normalizedSchoolId != null && Number.isNaN(normalizedSchoolId)) {
      return res.status(400).json({ message: "School ID must be numeric when provided" });
    }

    // Fetch school code for unique portal account naming
    let schoolCode = providedSchoolCode;
    if (normalizedSchoolId && !schoolCode) {
      const { data: schoolData, error: schoolError } = await supabase
        .from("schools")
        .select("code")
        .eq("school_id", normalizedSchoolId)
        .single();
      
      if (schoolError && schoolError.code !== 'PGRST116') {
        console.error("School code fetch error:", schoolError);
      }
      schoolCode = schoolData?.code;
    }
    
    // Build portal email with school code for uniqueness
    const portalEmail = schoolCode 
      ? `${trimmedAdmissionNumber.toLowerCase()}.${schoolCode.toLowerCase()}.${role}@portal`
      : `${trimmedAdmissionNumber.toLowerCase()}.${role}@portal`;
    
    let studentLookup = supabase
      .from("students")
      .select("student_id, first_name, last_name, school_id, admission_number, parent_name, schools!inner(code)")
      .ilike("admission_number", trimmedAdmissionNumber)
      .eq("is_deleted", false);

    if (normalizedSchoolId != null) {
      studentLookup = studentLookup.eq("school_id", normalizedSchoolId);
    }

    logTenantQuery("auth.portal_login.student_lookup", {
      table: "students",
      admissionNumber: trimmedAdmissionNumber,
      schoolId: normalizedSchoolId,
    });
    
    const { data: matchedStudents, error: studentLookupError } = await studentLookup;
    if (studentLookupError) throw studentLookupError;

    const uniqueStudentSchoolIds = Array.from(new Set((matchedStudents || []).map(student => student.school_id)));
    if (normalizedSchoolId == null && uniqueStudentSchoolIds.length > 1) {
      return res.status(400).json({
        message: "Multiple schools matched this admission number. Please choose your school ID to continue.",
        schoolOptions: uniqueStudentSchoolIds,
      });
    }

    const student = (matchedStudents || []).find(item => item.school_id === (normalizedSchoolId ?? uniqueStudentSchoolIds[0]));
    if (!student) {
      return res.status(401).json({ message: "Invalid admission number or school" });
    }

    const resolvedSchoolId = normalizedSchoolId ?? student.school_id;

    const { data: matchedUsers, error: userError } = await supabase
      .from("users")
      .select("user_id, full_name, email, password_hash, role, status, student_id, school_id")
      .eq("school_id", resolvedSchoolId)
      .eq("student_id", student.student_id)
      .eq("is_deleted", false)
      .limit(10);
      
    logTenantQuery("auth.portal_login.user_lookup", {
      table: "users",
      schoolId: resolvedSchoolId,
      studentId: student.student_id,
    });
    
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
      user = (matchedUsers || []).find(candidate => candidate.role === "parent") || null;
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
        const parentPasswordHash =
          legacyStudentAccount.password_hash && await bcrypt.compare(password, legacyStudentAccount.password_hash)
            ? legacyStudentAccount.password_hash
            : await bcrypt.hash(password, 10);

        // Fetch school code for unique email
        const { data: schoolData, error: schoolCodeError } = await supabase
          .from("schools")
          .select("code")
          .eq("school_id", student.school_id)
          .single();
          
        if (schoolCodeError && schoolCodeError.code !== 'PGRST116') {
          console.error("School code fetch error for parent bootstrap:", schoolCodeError);
        }
        const sc = schoolData?.code?.toLowerCase() || "school";

        const { data: insertedParent, error: insertedParentError } = await supabase
          .from("users")
          .insert({
            school_id: student.school_id,
            student_id: student.student_id,
            full_name: student.parent_name?.trim() || `Parent of ${student.first_name} ${student.last_name}`,
            email: `${trimmedAdmissionNumber.toLowerCase()}.${sc}.${role}@portal`,
            password_hash: parentPasswordHash,
            role: "parent",
            status: "active",
          })
          .select("user_id, full_name, email, password_hash, role, status, student_id, school_id")
          .single();

        if (!insertedParentError && insertedParent) {
          user = insertedParent;
        } else if (insertedParentError) {
          console.error("Failed to create parent account:", insertedParentError);
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
        // Fetch school code for unique email
        const { data: schoolData, error: schoolCodeError } = await supabase
          .from("schools")
          .select("code")
          .eq("school_id", student.school_id)
          .single();
          
        if (schoolCodeError && schoolCodeError.code !== 'PGRST116') {
          console.error("School code fetch error for bootstrap:", schoolCodeError);
        }
        const sc = schoolData?.code?.toLowerCase() || "school";
        
        const bootstrapEmail = `${trimmedAdmissionNumber.toLowerCase()}.${sc}.${role}@portal`;
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
        } else if (insertedUserError) {
          console.error("Failed to create bootstrap user:", insertedUserError);
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
    if (!passwordMatches) {
      logAuthFailure(req, { admissionNumber, reason: "Invalid credentials", schoolId: resolvedSchoolId });
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (user.status !== "active") {
      logAuthFailure(req, { admissionNumber, reason: "Account inactive", schoolId: resolvedSchoolId });
      return res.status(403).json({ message: "Account inactive" });
    }

    if (String(student.admission_number).trim().toLowerCase() !== trimmedAdmissionNumber.toLowerCase()) {
      return res.status(401).json({ message: "Portal account is not linked to that admission number" });
    }

    const name = role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`;

    const userPayload = {
      user_id: user.user_id,
      school_id: resolvedSchoolId,
      role,
      name,
      student_id: student.student_id,
      admission_number: student.admission_number,
      email: user.email,
    };

    const token = jwt.sign(userPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

    let supabaseToken = null;
    try {
      supabaseToken = generateSupabaseJWT(userPayload);
    } catch (error) {
      console.error("Failed to generate Supabase JWT:", error.message);
    }

    req.user = { user_id: user.user_id, school_id: resolvedSchoolId, role, name };
    logActivity(req, { action: "auth.portal_login", description: `${role} login: ${name}` });
    const sessionId = await createUserSession(req, user.user_id);

    // Check if defaulter blocking is enabled by admin
    let feeBlocked = false;
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from("school_settings")
        .select("setting_value")
        .eq("school_id", resolvedSchoolId)
        .eq("setting_key", "block_defaulters")
        .maybeSingle();
        
      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("Settings fetch error:", settingsError);
      }
      
      const blockDefaulters = settingsData?.setting_value !== "false";

      // Check student fee balance if blocking enabled
      if (blockDefaulters) {
        try {
          const { data: ledgerData, error: ledgerError } = await supabase
            .from("student_ledger")
            .select("balance_after")
            .eq("school_id", resolvedSchoolId)
            .eq("student_id", student.student_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (ledgerError && ledgerError.code !== 'PGRST116') {
            console.error("Fee balance check error:", ledgerError);
          }
          
          const balance = Number(ledgerData?.balance_after || 0);
          feeBlocked = balance > 0;
        } catch (err) {
          console.error("Fee balance check error:", err);
        }
      }
    } catch (settingsErr) {
      console.error("Settings check error:", settingsErr);
    }

    res.json({
      token,
      sessionId,
      supabaseToken,
      feeBlocked,
      user: {
        userId: user.user_id,
        schoolId: resolvedSchoolId,
        role,
        name,
        email: user.email,
        studentId: student.student_id,
        admissionNumber: student.admission_number,
      },
    });
  } catch (err) {
    console.error("Portal login error:", err);
    next(err);
  }
});

router.post("/logout", authRequired, validateSession, async (req, res, next) => {
  try {
    await revokeUserSession(req.headers["x-session-id"], req.user?.user_id || req.user?.userId || null);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/sessions", authRequired, validateSession, requireDirector(), async (_req, res, next) => {
  try {
    const result = await pgPool.query(`
      SELECT
        us.session_id, us.user_agent, us.ip_address,
        us.last_active, us.expires_at, us.created_at,
        u.user_id, u.full_name, u.role, u.email
      FROM user_sessions us
      JOIN users u ON u.user_id = us.user_id
      WHERE us.is_active = true
        AND us.expires_at > NOW()
      ORDER BY us.last_active DESC
    `);

    res.json(result.rows.map(row => {
      const [firstName, ...rest] = String(row.full_name || "").trim().split(/\s+/).filter(Boolean);
      return {
        session_id: row.session_id,
        user_agent: row.user_agent,
        ip_address: row.ip_address,
        last_active: row.last_active,
        expires_at: row.expires_at,
        created_at: row.created_at,
        user_id: row.user_id,
        first_name: firstName || "",
        last_name: rest.join(" "),
        role: row.role,
        email: row.email,
      };
    }));
  } catch (err) {
    next(err);
  }
});

router.delete("/sessions/:sessionId", authRequired, validateSession, requireDirector(), async (req, res, next) => {
  try {
    const result = await revokeUserSession(req.params.sessionId);
    if (!result.revoked) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json({
      success: true,
      message: Number(result.user_id) === Number(req.user.user_id || req.user.userId)
        ? "Your current session revoked. Logging out..."
        : "Session revoked successfully",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authRequired, validateSession, (req, res) => res.json({ user: req.user }));

// ─── 2FA Verification ───────────────────────────────────────────────────────
router.post("/verify-2fa", authRequired, async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.user_id || req.user.userId;
    const schoolId = req.user.school_id || req.user.schoolId;

    const { data: user } = await supabase
      .from("users")
      .select("two_factor_secret, two_factor_enabled")
      .eq("user_id", userId)
      .eq("school_id", schoolId)
      .single();

    if (!user || !user.two_factor_enabled) {
      return res.status(400).json({ message: "2FA not enabled for this account" });
    }

    const isValid = verifyTwoFactorToken(user.two_factor_secret, token);
    if (!isValid) {
      await logSecurityEvent(schoolId, userId, "login_2fa_failed", req, { reason: "Invalid 2FA token" });
      return res.status(401).json({ code: "2FA_INVALID", message: "Invalid two-factor authentication token" });
    }

    await logSecurityEvent(schoolId, userId, "login_2fa_success", req, {});
    const { data: updatedUser } = await supabase
      .from("users")
      .select("user_id, full_name, email, role, status")
      .eq("user_id", userId)
      .single();

    const userPayload = { user_id: updatedUser.user_id, school_id: schoolId, role: updatedUser.role, name: updatedUser.full_name, email: updatedUser.email };
    const newToken = jwt.sign(userPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    const sessionId = await createUserSession(req, userId);

    res.json({ token: newToken, sessionId, user: { userId: updatedUser.user_id, schoolId, role: updatedUser.role, name: updatedUser.full_name, email: updatedUser.email } });
  } catch (err) {
    next(err);
  }
});

// ─── 2FA Setup ───────────────────────────────────────────────────────────
router.get("/2fa/status", authRequired, validateSession, async (req, res) => {
  const userId = req.user.user_id || req.user.userId;
  const schoolId = req.user.school_id || req.user.schoolId;
  supabase.from("users").select("two_factor_enabled, two_factor_backup_codes").eq("user_id", userId).eq("school_id", schoolId).single().then(({ data }) => {
    res.json({ enabled: !!data?.two_factor_enabled, backupCodesCount: data?.two_factor_backup_codes?.length || 0 });
  });
});

router.post("/2fa/setup", authRequired, validateSession, async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.userId;
    const schoolId = req.user.school_id || req.user.schoolId;
    const secret = generateTwoFactorSecret();
    const backupCodes = generateBackupCodes(10);

    await supabase
      .from("users")
      .update({ two_factor_secret: secret.base32, two_factor_backup_codes: backupCodes })
      .eq("user_id", userId)
      .eq("school_id", schoolId);

    res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url, backupCodes });
  } catch (err) {
    next(err);
  }
});

router.post("/2fa/enable", authRequired, validateSession, async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.userId;
    const schoolId = req.user.school_id || req.user.schoolId;
    const { token } = req.body;

    const { data: user } = await supabase.from("users").select("two_factor_secret").eq("user_id", userId).eq("school_id", schoolId).single();
    if (!user || !verifyTwoFactorToken(user.two_factor_secret, token)) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    await supabase.from("users").update({ two_factor_enabled: true }).eq("user_id", userId).eq("school_id", schoolId);
    await logSecurityEvent(schoolId, userId, "2fa_enabled", req, {});
    res.json({ enabled: true, message: "Two-factor authentication enabled" });
  } catch (err) {
    next(err);
  }
});

router.post("/2fa/disable", authRequired, validateSession, async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.userId;
    const schoolId = req.user.school_id || req.user.schoolId;
    const { password } = req.body;

    const { data: user } = await supabase.from("users").select("password_hash").eq("user_id", userId).eq("school_id", schoolId).single();
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    await supabase.from("users").update({ two_factor_enabled: false, two_factor_secret: null, two_factor_backup_codes: null }).eq("user_id", userId).eq("school_id", schoolId);
    await logSecurityEvent(schoolId, userId, "2fa_disabled", req, {});
    res.json({ enabled: false, message: "Two-factor authentication disabled" });
  } catch (err) {
    next(err);
  }
});

// ─── Device Recognition ──────────────────────────────────────────────────
router.get("/devices", authRequired, validateSession, async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.userId;
    const result = await pgPool.query(`SELECT session_id, user_agent, ip_address, last_active, created_at, is_active FROM user_sessions WHERE user_id = $1 AND is_active = true ORDER BY last_active DESC`, [Number(userId)]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post("/devices/trust", authRequired, validateSession, async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.userId;
    const { sessionId, name } = req.body;
    await pgPool.query("UPDATE user_sessions SET device_name = $1 WHERE session_id = $2 AND user_id = $3", [name, sessionId, Number(userId)]);
    res.json({ trusted: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/devices/:sessionId", authRequired, validateSession, async (req, res, next) => {
  try {
    const result = await revokeUserSession(req.params.sessionId);
    if (!result.revoked) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json({ success: true, message: "Device session revoked" });
  } catch (err) {
    next(err);
  }
});

// ─── Login History ───────────────────────────────────────────────────────
router.get("/login-history", authRequired, validateSession, async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.userId;
    const schoolId = req.user.school_id || req.user.schoolId;
    const { data } = await supabase
      .from("security_logs")
      .select("event_type, ip_address, user_agent, details, created_at")
      .eq("user_id", userId)
      .eq("school_id", schoolId)
      .in("event_type", ["login_success", "login_failed", "login_2fa_required", "login_2fa_success", "login_2fa_failed", "logout", "account_locked"])
      .order("created_at", { ascending: false })
      .limit(100);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// ─── My Sessions ─────────────────────────────────────────────────────────
router.get("/my-sessions", authRequired, validateSession, async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.userId;
    const result = await pgPool.query(`
      SELECT session_id, user_agent, ip_address, last_active, expires_at, created_at, is_active
      FROM user_sessions
      WHERE user_id = $1 AND is_active = true
      ORDER BY last_active DESC
    `, [Number(userId)]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.delete("/my-sessions/:sessionId", authRequired, validateSession, async (req, res, next) => {
  try {
    const result = await revokeUserSession(req.params.sessionId, req.user?.user_id || req.user?.userId);
    if (!result.revoked) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json({ success: true, message: Number(result.user_id) === Number(req.user.user_id || req.user.userId) ? "Your session revoked" : "Session revoked successfully" });
  } catch (err) {
    next(err);
  }
});

router.post("/my-sessions/revoke-all", authRequired, validateSession, async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.userId;
    const currentSessionId = req.headers["x-session-id"];
    await pgPool.query("UPDATE user_sessions SET is_active = false WHERE user_id = $1 AND session_id <> $2 AND is_active = true", [Number(userId), currentSessionId]);
    res.json({ success: true, message: "All other sessions revoked" });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authRequired, validateSession, (req, res) => res.json({ user: req.user }));

export default router;
