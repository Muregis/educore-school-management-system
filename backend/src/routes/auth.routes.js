import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authRequired } from "../middleware/auth.js";
import { supabase, supabasePrivate } from "../config/supabaseClient.js";
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
      .from("public.schools")
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
      .from("public.schools")
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
      { expiresIn: process.env.JWT_EXPIRES_IN }
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

// ─── POST /api/auth/change-password ───────────────────────────────────────
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

      // Resolve user from userId (set by changePasswordGate from changeToken or auth session)
      // Join with private.user_credentials to get must_change_password flag (via supabasePrivate client)
      const userFromBody = await supabase
        .from("public.users")
        .select("password_hash, school_id, email, full_name")
        .eq("user_id", userId)
        .single();

      if (userFromBody.error || !userFromBody.data) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = userFromBody.data;
      const schoolId = user.school_id;

      // Get must_change_password from private.user_credentials (via supabasePrivate client)
      const { data: credentials, error: credentialsError } = await supabasePrivate
        .from("user_credentials")
        .select("must_change_password")
        .eq("user_id", userId)
        .single();

      const mustChangePassword = credentials?.must_change_password === true;

      // Determine if this is a forced password change (no current password verification)
      const isForcedChange = !currentPassword;

      // If not forced change, verify current password
      if (!isForcedChange && currentPassword) {
        const isValidCurrent = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidCurrent) {
          // Increment failed login attempts
          await supabase
            .from("public.users")
            .update({ failed_login_attempts: user.failed_login_attempts + 1 })
            .eq("user_id", userId);
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }

      // Validate new password against policy
      const policy = resolvePasswordPolicy();
      const check = validatePassword(newPassword, {
        email: user.email,
        firstName: user.full_name,
      }, policy);
      if (!check.valid) {
        return res.status(400).json({
          message: "Password does not meet security requirements",
          errors: check.errors,
        });
      }

      // Hash new password
      const newHash = await bcrypt.hash(newPassword, 12);

      // Begin updating credential records

      // 1. Update public.users.password_hash (authoritative source)
      const { error: pubError } = await supabase
        .from("public.users")
        .update({
          password_hash: newHash,
          password_changed_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (pubError) {
        return res.status(500).json({ message: "Failed to update public password hash" });
      }

      // 2. Update private.user_credentials.password_hash (keep in sync via supabasePrivate)
      //    Also set must_change_password = false and password_changed_at
      const { error: privError } = await supabasePrivate
        .from("user_credentials")
        .update({
          password_hash: newHash,
          password_changed_at: new Date().toISOString(),
          must_change_password: false,
        })
        .eq("user_id", userId);

      if (privError) {
        console.error('Auth route: failed to update private.user_credentials (via supabasePrivate):', privError.message);
        // Public hash already updated; continue with warning
      }

      // 3. Update password_history in public.users
      //    Retain only the configured number of previous hashes (prevent unbounded growth)
      const { data: existingUser } = await supabase
        .from("public.users")
        .select('password_history')
        .eq("user_id", userId)
        .single();

      let history = existingUser?.password_history || [];
      // Add current hash (before it was replaced) to history if not already present
      const currentHashBeforeUpdate = user.password_hash;
      if (history.length > 0 && history[0] !== currentHashBeforeUpdate) {
        history.unshift(currentHashBeforeUpdate);
      }
      // Limit to 5 previous hashes (matching preventReuse policy config)
      const maxHistory = 5;
      history = history.slice(0, maxHistory);

      const { error: histError } = await supabase
        .from("public.users")
        .update({ password_history: history })
        .eq("user_id", userId);

      if (histError) {
        console.error('Auth route: failed to update password_history:', histError.message);
      }

      // 4. Invalidate sessions by incrementing token version
      const { error: versionError } = await supabase
        .from("public.users")
        .update({ token_version: user.token_version + 1 })
        .eq("user_id", userId);

      if (versionError) {
        return res.status(500).json({ message: "Failed to invalidate sessions" });
      }

      // 5. Log audit events
      await logActivity(req, { action: "auth.password_change", userId: userId, description: "Password changed successfully" });
      await supabase
        .from("public.users")
        .update({ failed_login_attempts: 0 }) // Reset failed attempts on successful change
        .eq("user_id", userId);

      // 6. Return success response
      // If this was a forced change, also indicate that a normal session can now be created
      res.json({ 
        message: "Password updated. Please sign in with your new password.",
        passwordChangedAt: new Date().toISOString(),
        wasForcedChange: isForcedChange
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