import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authRequired } from "../middleware/auth.js";
import { supabase } from "../config/supabaseClient.js";
import { logActivity } from "../helpers/activity.logger.js";
import { authLogin } from "../services/auth.service.js";
import { requireRoles, requireDirector } from "../middleware/roles.js";
import { authorize } from "../middleware/permissions.js";
import { PromotionService } from "../services/PromotionService.js";
import { studentDataRateLimit } from "../middleware/rateLimit.js";
import multer from "multer";
import { getTeacherAssignedClasses } from "../utils/getTeacherClasses.js";
import { getPortalStudentIds, requirePortalStudentAccess } from "../utils/portalAccess.js";
import { changePasswordGate } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { resolvePasswordPolicy, validatePassword } from "../middleware/passwordPolicy.js";

const router = Router();

// ─── Public pre-login routes (called before user is authenticated) ────────
router.get("/resolve-school", async (req, res, next) => {
  try {
    const { hostname, role } = req.query;
    if (!hostname) {
      return res.status(400).json({ message: "hostname query param required" });
    }
    // Resolve school by hostname - simplified lookup
    const { data: school, error } = await supabase
      .from("schools")
      .select("school_id, name, slug, plan")
      .eq("slug", hostname)
      .single();

    if (error || !school) {
      // Return fallback school data so login UI can proceed
      return res.status(200).json({
        schoolId: null,
        schoolName: "EduCore",
        schoolSlug: hostname,
        plan: "starter",
      });
    }

    res.json({
      schoolId: school.school_id,
      schoolName: school.name,
      schoolSlug: school.slug,
      plan: school.plan || "starter",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/lookup-school", async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) {
      return res.status(400).json({ message: "schoolId query param required" });
    }
    const { data: school, error } = await supabase
      .from("schools")
      .select("school_id, name, slug, plan")
      .eq("school_id", schoolId)
      .single();

    if (error || !school) {
      // Return fallback school data so login UI can proceed
      return res.status(200).json({
        schoolId: null,
        schoolName: "EduCore",
        schoolSlug: null,
        plan: "starter",
      });
    }

    res.json({
      schoolId: school.school_id,
      schoolName: school.name,
      schoolSlug: school.slug,
      plan: school.plan || "starter",
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ───────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, schoolId } = req.body || {};
    
    // If schoolId not provided, resolve it from email
    let effectiveSchoolId = schoolId;
    if (!schoolId) {
      const { data: users, error } = await supabase
        .from('users')
        .select('school_id')
        .ilike('email', email.trim().toLowerCase())
        .eq('is_deleted', false)
        .limit(5);
      if (error || !users || users.length === 0) {
        return res.status(400).json({ message: "User not found" });
      }
      if (users.length === 1) {
        effectiveSchoolId = users[0].school_id;
      } else {
        // Many schools for this email — return school options
        const schoolOptions = users.map(u => ({
          schoolId: u.school_id,
          schoolName: u.full_name || u.email
        }));
        return res.status(400).json({
          message: "Multiple schools found for this email. Please select a school.",
          schoolOptions
        });
      }
    } else {
      effectiveSchoolId = Number(schoolId);
    }

    const result = await authLogin(email, password, effectiveSchoolId);
    if (!result) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // NEW: Handle requires_password_change response
    if (result.requires_password_change) {
      // Issue short-lived changeToken JWT (TTL 10 minutes)
      const changeToken = jwt.sign(
        { user_id: result.user_id, school_id: result.school_id, purpose: "password_change" },
        env.jwtSecret,
        { expiresIn: "10m" }
      );
      return res.json({
        requires_password_change: true,
        changeToken,
        user_id: result.user_id,
        school_id: result.school_id,
        message: "Password change required. Please update your password.",
      });
    }

    const user = result.user;
    const token = jwt.sign(
      { user_id: user.user_id, school_id: user.school_id, role: user.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn || process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Fetch school plan info
    const { data: schoolData } = await supabase
      .from("schools")
      .select("plan, plan_expires_at, is_branch, parent_school_id, branch_code")
      .eq("school_id", user.school_id)
      .single();

    let schoolPlan = schoolData?.plan || "starter";

    if (schoolData?.plan_expires_at) {
      const expiresAt = new Date(schoolData.plan_expires_at);
      const now = new Date();
      if (expiresAt < now && schoolPlan !== "starter") {
        schoolPlan = "expired";
      }
    }

    // Hide branch info from parents/students
    const isParentOrStudent = user.role === "parent" || user.role === "student";
    const branchInfo = isParentOrStudent ? false : (schoolData?.is_branch || false);

    res.json({
      token,
      user: {
        userId: user.user_id,
        schoolId: user.school_id,
        role: user.role,
        name: user.full_name,
        email: user.email,
        plan: schoolPlan,
        isBranch: isParentOrStudent ? false : branchInfo,
        parentSchoolId: isParentOrStudent ? null : (schoolData?.parent_school_id || null),
        branchCode: isParentOrStudent ? null : (schoolData?.branch_code || null),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────
// change-password:
router.post(
  "/change-password",
  changePasswordGate,
  async (req, res, next) => {
    try {
      if (!req.user?.user_id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { currentPassword, newPassword } = req.body || {};
      const userId = req.user.user_id;

      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select(
          "user_id, password_hash, school_id, email, full_name, token_version, failed_login_attempts, password_history"
        )
        .eq("user_id", userId)
        .single();

      if (userError || !user) {
        return res.status(404).json({ message: "User not found" });
      }

      const schoolId = user.school_id;
      const isForcedChange = !currentPassword;

      if (!isForcedChange && currentPassword) {
        if (!user.password_hash) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
        const isValidCurrent = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidCurrent) {
          await supabase
            .from("users")
            .update({
              failed_login_attempts: (user.failed_login_attempts || 0) + 1,
            })
            .eq("user_id", userId);
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }

      const policy = resolvePasswordPolicy();
      const check = validatePassword(
        newPassword,
        { email: user.email, firstName: user.full_name },
        policy
      );
      if (!check.valid) {
        return res.status(400).json({
          message: "Password does not meet security requirements",
          errors: check.errors,
        });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      const changedAt = new Date().toISOString();

      let history = Array.isArray(user.password_history) ? [...user.password_history] : [];
      if (user.password_hash) {
        history.unshift(user.password_hash);
      }
      history = history.slice(0, 5);

      const { error: pubError } = await supabase
        .from("users")
        .update({
          password_hash: newHash,
          password_changed_at: changedAt,
          password_history: history,
          token_version: (user.token_version || 0) + 1,
          failed_login_attempts: 0,
        })
        .eq("user_id", userId);

      if (pubError) {
        console.error("change-password users update:", pubError.message);
        return res.status(500).json({ message: "Failed to update password" });
      }

      // Optional sync — do not fail the request if RPC missing
      const { error: privError } = await supabase.rpc("update_user_credentials", {
        p_user_id: userId,
        p_password_hash: newHash,
        p_password_changed_at: changedAt,
        p_must_change_password: false,
      });
      if (privError) {
        console.error("update_user_credentials:", privError.message);
      }

      await logActivity(req, {
        action: "auth.password_change",
        userId,
        description: "Password changed successfully",
      });

      return res.json({
        message: "Password updated. Please sign in with your new password.",
        passwordChangedAt: changedAt,
        wasForcedChange: isForcedChange,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/change-password-token ─────────────────────────────────
router.post("/change-password-token", changePasswordGate, async (req, res, next) => {
  try {
    // Accept changeToken only for change-password route
    res.json({ message: "Change password token accepted. Use POST /change-password." });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────
router.get("/me", authRequired, async (req, res, next) => {
  try {
    const user = req.user;
    res.json({
      userId: user.user_id,
      schoolId: user.school_id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});

// ─── The rest of the routes remain unchanged ───────────────────────────────
// (student, teacher routes etc. - omitted for brevity)

export default router;