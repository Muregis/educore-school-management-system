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
import { logTenantContext, logTenantQuery } from "../helpers/tenant-debug.logger.js";

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
      uniqueSchools.push(await buildSchoolBranding(school));
    }
  }

  return uniqueSchools;
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

    if (numericSchoolId && !Number.isNaN(numericSchoolId)) {
      const matchedSchool = await findSchoolById(numericSchoolId);
      if (matchedSchool) return res.json(await buildSchoolBranding(matchedSchool));
    }

    const subdomain = getHostSubdomain(hostname);
    if (subdomain) {
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
    }

    if (loginId) {
      const schools = await resolveSchoolCandidates({ loginId, role });
      if (schools.length === 1) return res.json(schools[0]);
      if (schools.length > 1) return res.json({ ...DEFAULT_SCHOOL_BRANDING, schoolOptions: schools, ambiguous: true });
    }

    return res.json({ ...DEFAULT_SCHOOL_BRANDING });
  } catch (_err) {
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
router.get("/me", authRequired, (req, res) => {
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
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
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

      return res.json({
        token,
        supabaseToken: null, // Superadmin doesn't need Supabase token
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
      return res.status(400).json({ message: "schoolId must be numeric when provided" });
    }

    if (normalizedSchoolId == null) {
      const { data: candidates, error } = await supabase
        .from("users")
        .select("school_id")
        .ilike("email", email.trim())
        .eq("is_deleted", false);
      logTenantQuery("auth.login.school_lookup", { table: "users", email, schoolId: null });
      if (error) throw error;

      const unique = Array.from(new Set((candidates || []).map(user => user.school_id)));
      if (unique.length === 0) {
        return res.status(404).json({ message: "We couldn't find your school for that email. Please enter the school ID or contact admin." });
      }
      if (unique.length > 1) {
        return res.status(400).json({ message: "Multiple schools matched this email. Please choose your school ID to continue.", schoolOptions: unique });
      }
      normalizedSchoolId = unique[0];
    }

    const authResult = await authLogin(email, password, normalizedSchoolId);
    if (!authResult) {
      logAuthFailure(req, { email, reason: "User not found", schoolId });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { user } = authResult;
    if (user.status !== "active") {
      return res.status(403).json({ message: "Account inactive" });
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

    // NEW: Fetch school with branch info
    const { data: schoolData } = await supabase
      .from("schools")
      .select("plan, plan_expires_at, is_branch, parent_school_id, branch_code")
      .eq("school_id", normalizedSchoolId)
      .single();

    let schoolPlan = schoolData?.plan || "starter";

    // Check if plan has expired
    if (schoolData?.plan_expires_at) {
      const expiresAt = new Date(schoolData.plan_expires_at);
      const now = new Date();
      if (expiresAt < now && schoolPlan !== 'starter') {
        await supabase
          .from('schools')
          .update({ plan: 'starter' })
          .eq('school_id', normalizedSchoolId);
        schoolPlan = 'starter';
      }
    }

    req.user = userPayload;
    logActivity(req, { action: "auth.login", description: `${role} login: ${name}` });

    // Hide branch info from parents/students - they see unified school
    const isParentOrStudent = role === "parent" || role === "student";
    
    res.json({
      token,
      supabaseToken,
      user: { 
        userId: user.user_id, 
        schoolId: normalizedSchoolId, 
        role, 
        name, 
        email: user.email, 
        plan: schoolPlan,
        // Branch info: HIDDEN from parents, visible to staff
        isBranch: isParentOrStudent ? false : (schoolData?.is_branch || false),
        parentSchoolId: isParentOrStudent ? null : (schoolData?.parent_school_id || null),
        branchCode: isParentOrStudent ? null : (schoolData?.branch_code || null)
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/portal-login", authRateLimit, async (req, res, next) => {
  try {
    const { admissionNumber, password, schoolId = null, schoolCode: providedSchoolCode = null, role = "parent" } = req.body;
    logTenantContext("auth.portal_login.request", req, { admissionNumber, schoolId, schoolCode: providedSchoolCode, role });
    if (!admissionNumber || !password) {
      return res.status(400).json({ message: "admissionNumber and password are required" });
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
    
    // Fetch school code for unique portal account naming
    let schoolCode = providedSchoolCode;
    if (normalizedSchoolId && !schoolCode) {
      const { data: schoolData } = await supabase
        .from("schools")
        .select("code")
        .eq("school_id", normalizedSchoolId)
        .single();
      schoolCode = schoolData?.code;
    }
    if (normalizedSchoolId != null && Number.isNaN(normalizedSchoolId)) {
      return res.status(400).json({ message: "schoolId must be numeric when provided" });
    }

    // Build portal email with school code for uniqueness: adm001.schoolcode.parent@portal
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
        const { data: schoolData } = await supabase
          .from("schools")
          .select("code")
          .eq("school_id", student.school_id)
          .single();
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
        const { data: schoolData } = await supabase
          .from("schools")
          .select("code")
          .eq("school_id", student.school_id)
          .single();
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

    // Check if defaulter blocking is enabled by admin
    let feeBlocked = false;
    const { data: settingsData } = await supabase
      .from("school_settings")
      .select("setting_value")
      .eq("school_id", resolvedSchoolId)
      .eq("setting_key", "block_defaulters")
      .maybeSingle();
    const blockDefaulters = settingsData?.setting_value !== "false";

    // Check student fee balance if blocking enabled
    if (blockDefaulters) {
      try {
        const { data: ledgerData } = await supabase
          .from("student_ledger")
          .select("balance_after")
          .eq("school_id", resolvedSchoolId)
          .eq("student_id", student.student_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const balance = Number(ledgerData?.balance_after || 0);
        feeBlocked = balance > 0;
      } catch (err) {
        console.error("Fee balance check error:", err);
      }
    }

    res.json({
      token,
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
    next(err);
  }
});

router.get("/me", authRequired, (req, res) => res.json({ user: req.user }));

export default router;
