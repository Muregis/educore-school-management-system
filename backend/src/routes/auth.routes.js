import { Router } from "express";
import bcrypt from "bcryptjs";
import { authRequired } from "../middleware/auth.js";
import { logActivity } from "../helpers/activity.logger.js";
import { requireRoles, requireDirector } from "../middleware/roles.js";
import { authorize } from "../middleware/permissions.js";
import { PromotionService } from "../services/PromotionService.js";
import { studentDataRateLimit } from "../middleware/rateLimit.js";
import multer from "multer";
import { getTeacherAssignedClasses } from "../utils/getTeacherClasses.js";
import { getPortalStudentIds, requirePortalStudentAccess } from "../utils/portalAccess.js";
import { changePasswordGate } from "../middleware/auth.js";
import router from "./auth.routes.js";

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

const router = Router();
router.use(authRequired);

// ─── POST /api/auth/login ───────────────────────────────────────────────
router.post("/login", changePasswordGate, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const result = await authLogin(email, password, req.user.school_id);
    if (!result) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.user;
    const token = jwt.sign(
      { user_id: user.user_id, school_id: user.school_id, role: user.role },
      process.env.JWT_SECRET,
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
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      // Verify current password
      const user = req.user;
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        // Increment failed login attempts
        await supabase
          .from("public.users")
          .update({ failed_login_attempts: user.failed_login_attempts + 1 })
          .eq("user_id", user.user_id);
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Validate new password against policy
      const policy = await getSchoolPasswordPolicy(user.school_id);
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

      // Update only public.users.password_hash (single store)
      const { error } = await supabase
        .from("public.users")
        .update({
          password_hash: newHash,
          password_changed_at: new Date().toISOString(),
        })
        .eq("user_id", user.user_id);

      if (error) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      // Invalidate sessions by incrementing token version
      await supabase
        .from("public.users")
        .update({ token_version: user.token_version + 1 })
        .eq("user_id", user.user_id);

      // Log the change
      await logActivity(req, { action: "auth.password_change", userId: user.user_id, description: "Password changed" });

      res.json({ message: "Password updated. Please sign in with your new password." });
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