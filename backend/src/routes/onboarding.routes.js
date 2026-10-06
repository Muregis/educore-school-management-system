/**
 * Public school signup + first-run onboarding.
 *
 * POST /api/onboarding/register-school  (public)
 * GET  /api/onboarding/status           (auth)
 * POST /api/onboarding/complete         (auth, director)
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { resolvePasswordPolicy, validatePassword } from "../middleware/passwordPolicy.js";

const router = Router();

const PRIMARY_CLASSES = [
  "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8",
];
const SECONDARY_CLASSES = ["Form 1", "Form 2", "Form 3", "Form 4"];
const CORE_SUBJECTS = [
  { name: "Mathematics", code: "MATH" },
  { name: "English", code: "ENG" },
  { name: "Kiswahili", code: "KIS" },
  { name: "Science", code: "SCI" },
  { name: "Social Studies", code: "SST" },
  { name: "Religious Education", code: "RE" },
  { name: "Creative Arts", code: "ART" },
  { name: "Physical Education", code: "PE" },
];

function slugify(name) {
  const base = String(name || "school")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "school";
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

function kenyanTermDates(year) {
  const y = Number(year) || new Date().getFullYear();
  return [
    { name: "Term 1", start: `${y}-01-06`, end: `${y}-04-04`, is_current: false },
    { name: "Term 2", start: `${y}-05-05`, end: `${y}-08-01`, is_current: false },
    { name: "Term 3", start: `${y}-09-01`, end: `${y}-11-28`, is_current: true },
  ];
}

function classListForType(schoolType) {
  const t = String(schoolType || "primary").toLowerCase();
  if (t === "secondary") return SECONDARY_CLASSES;
  if (t === "both" || t === "mixed") return [...PRIMARY_CLASSES, ...SECONDARY_CLASSES];
  return PRIMARY_CLASSES;
}

async function upsertSetting(schoolId, key, value) {
  if (value === undefined || value === null) return;
  await supabase.from("school_settings").upsert(
    {
      school_id: schoolId,
      setting_key: key,
      setting_value: String(value),
    },
    { onConflict: "school_id,setting_key" }
  );
}

function issueToken(user) {
  return jwt.sign(
    { user_id: user.user_id, school_id: user.school_id, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn || process.env.JWT_EXPIRES_IN || "7d" }
  );
}

/**
 * POST /api/onboarding/register-school
 * Body: { schoolName, directorName, email, password, phone? }
 */
router.post("/register-school", async (req, res, next) => {
  try {
    const schoolName = String(req.body?.schoolName || "").trim();
    const directorName = String(req.body?.directorName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const phone = String(req.body?.phone || "").trim() || null;

    if (!schoolName || schoolName.length < 2) {
      return res.status(400).json({ message: "School name is required" });
    }
    if (!directorName || directorName.length < 2) {
      return res.status(400).json({ message: "Your full name is required" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const policy = resolvePasswordPolicy();
    const check = validatePassword(password, { email, firstName: directorName }, policy);
    if (!check.valid) {
      return res.status(400).json({
        message: "Password does not meet security requirements",
        errors: check.errors,
      });
    }

    const { data: existing } = await supabase
      .from("users")
      .select("user_id")
      .ilike("email", email)
      .eq("is_deleted", false)
      .limit(1);

    if (existing?.length) {
      return res.status(409).json({
        message: "An account with this email already exists. Please sign in instead.",
      });
    }

    const slug = slugify(schoolName);
    const code = `SCH-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const schoolPayload = {
      name: schoolName,
      code,
      slug,
      email,
      phone,
      plan: "starter",
      is_deleted: false,
    };

    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .insert(schoolPayload)
      .select("school_id, name, code, slug, plan")
      .single();

    if (schoolErr) {
      console.error("[onboarding] school insert failed", schoolErr);
      return res.status(500).json({
        message: "Could not create school. Please try again.",
        detail: schoolErr.message,
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error: userErr } = await supabase
      .from("users")
      .insert({
        school_id: school.school_id,
        full_name: directorName,
        email,
        role: "director",
        status: "active",
        is_deleted: false,
        password_hash: passwordHash,
        phone,
      })
      .select("user_id, school_id, full_name, email, role, status")
      .single();

    if (userErr) {
      console.error("[onboarding] user insert failed", userErr);
      await supabase.from("schools").update({ is_deleted: true }).eq("school_id", school.school_id);
      return res.status(500).json({
        message: "Could not create director account.",
        detail: userErr.message,
      });
    }

    await upsertSetting(school.school_id, "onboarding_completed", "false");
    await upsertSetting(school.school_id, "onboarding_step", "0");

    const token = issueToken(user);

    return res.status(201).json({
      token,
      user: {
        userId: user.user_id,
        schoolId: user.school_id,
        role: user.role,
        name: user.full_name,
        email: user.email,
        plan: school.plan || "starter",
        isBranch: false,
        parentSchoolId: null,
        branchCode: null,
        onboardingCompleted: false,
      },
      school: {
        schoolId: school.school_id,
        name: school.name,
        code: school.code,
        slug: school.slug,
      },
      needsOnboarding: true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/onboarding/status
 */
router.get("/status", authRequired, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId || req.user.school_id;
    const { data } = await supabase
      .from("school_settings")
      .select("setting_key, setting_value")
      .eq("school_id", schoolId)
      .in("setting_key", ["onboarding_completed", "onboarding_step"]);

    const map = new Map((data || []).map((r) => [r.setting_key, r.setting_value]));
    const completed = map.get("onboarding_completed") === "true";

    const { count: classCount } = await supabase
      .from("classes")
      .select("class_id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_deleted", false);

    res.json({
      onboardingCompleted: completed,
      step: Number(map.get("onboarding_step") || 0),
      hasClasses: (classCount || 0) > 0,
      needsOnboarding: !completed && (classCount || 0) === 0,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/onboarding/complete
 * Body: {
 *   schoolType: "primary" | "secondary" | "both",
 *   academicYear: 2026,
 *   defaultTuition: number,
 *   activeTerm?: "Term 1" | "Term 2" | "Term 3"
 * }
 */
router.post("/complete", authRequired, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId || req.user.school_id;
    const role = String(req.user.role || "").toLowerCase();
    if (!["director", "admin", "superadmin"].includes(role)) {
      return res.status(403).json({ message: "Only directors can complete school setup" });
    }

    const schoolType = String(req.body?.schoolType || "primary").toLowerCase();
    const academicYear = Number(req.body?.academicYear) || new Date().getFullYear();
    const defaultTuition = Math.max(0, Number(req.body?.defaultTuition) || 0);
    const preferredActive = String(req.body?.activeTerm || "Term 3");

    const classNames = classListForType(schoolType);
    const classRows = classNames.map((class_name, i) => ({
      school_id: schoolId,
      class_name,
      class_order: i + 1,
      status: "active",
      is_deleted: false,
      next_class_name: classNames[i + 1] || null,
    }));

    const { data: existingClasses } = await supabase
      .from("classes")
      .select("class_id")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .limit(1);

    let createdClasses = [];
    if (!existingClasses?.length) {
      const { data, error } = await supabase
        .from("classes")
        .insert(classRows)
        .select("class_id, class_name");
      if (error) {
        console.error("[onboarding] classes", error);
        return res.status(400).json({ message: "Failed to create classes", detail: error.message });
      }
      createdClasses = data || [];
    } else {
      const { data } = await supabase
        .from("classes")
        .select("class_id, class_name")
        .eq("school_id", schoolId)
        .eq("is_deleted", false);
      createdClasses = data || [];
    }

    // Subjects (best-effort)
    try {
      const subjectRows = CORE_SUBJECTS.map((s) => ({
        school_id: schoolId,
        name: s.name,
        code: s.code,
        is_deleted: false,
      }));
      await supabase.from("subjects").insert(subjectRows);
    } catch (e) {
      console.warn("[onboarding] subjects skip", e?.message);
    }

    // Terms via school_settings (works even if academic_years table differs)
    const terms = kenyanTermDates(academicYear).map((t) => ({
      ...t,
      is_current: t.name === preferredActive,
    }));
    if (!terms.some((t) => t.is_current)) terms[terms.length - 1].is_current = true;
    const activeTerm = terms.find((t) => t.is_current)?.name || "Term 3";

    await upsertSetting(schoolId, "academic_year", String(academicYear));
    await upsertSetting(schoolId, "current_term", activeTerm);
    await upsertSetting(schoolId, "school_type", schoolType);
    await upsertSetting(schoolId, "term_start", terms.find((t) => t.is_current)?.start || "");
    await upsertSetting(schoolId, "term_end", terms.find((t) => t.is_current)?.end || "");

    // Try academic_years / terms tables if present
    try {
      const { data: yearRow } = await supabase
        .from("academic_years")
        .insert({
          school_id: schoolId,
          name: String(academicYear),
          start_date: `${academicYear}-01-01`,
          end_date: `${academicYear}-12-31`,
          is_current: true,
        })
        .select("id, academic_year_id")
        .maybeSingle();

      const yearId = yearRow?.id || yearRow?.academic_year_id;
      if (yearId) {
        for (const t of terms) {
          await supabase.from("academic_terms").insert({
            school_id: schoolId,
            academic_year_id: yearId,
            name: t.name,
            start_date: t.start,
            end_date: t.end,
            is_current: t.is_current,
          });
        }
      }
    } catch (e) {
      console.warn("[onboarding] academic_years optional", e?.message);
    }

    // Fee structures for each class × active term
    if (defaultTuition > 0 && createdClasses.length) {
      const feeRows = createdClasses.map((c) => ({
        school_id: schoolId,
        class_name: c.class_name,
        term: activeTerm,
        tuition: defaultTuition,
        activity: 0,
        misc: 0,
      }));
      const { error: feeErr } = await supabase.from("fee_structures").insert(feeRows);
      if (feeErr) console.warn("[onboarding] fee_structures", feeErr.message);
    }

    // Update school profile fields when columns exist
    await supabase
      .from("schools")
      .update({
        school_type: schoolType,
        term: activeTerm,
        year: String(academicYear),
        academic_year: String(academicYear),
      })
      .eq("school_id", schoolId);

    await upsertSetting(schoolId, "onboarding_completed", "true");
    await upsertSetting(schoolId, "onboarding_step", "4");

    res.json({
      ok: true,
      classesCreated: createdClasses.length,
      activeTerm,
      academicYear,
      schoolType,
      defaultTuition,
      message: "School setup complete. You can add students and record fees.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
