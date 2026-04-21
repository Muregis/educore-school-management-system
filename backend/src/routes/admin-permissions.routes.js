/**
 * Admin Permissions API Routes
 * Allows Directors to delegate permissions to Admins
 * Only accessible by Director and Superadmin roles
 */

import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { supabase } from "../config/supabaseClient.js";

const router = Router();
router.use(authRequired);

/**
 * GET /api/users/admins
 * Get all admin users (for director to manage)
 */
router.get("/admins", requireRoles("director", "superadmin"), async (req, res) => {
  try {
    const { schoolId, role, user_id } = req.user;

    // Directors see admins from all schools, superadmin sees all
    let query = supabase
      .from("users")
      .select("user_id, school_id, full_name, email, role, status, delegated_permissions")
      .eq("role", "admin")
      .eq("is_deleted", false);

    if (role === "director") {
      // Director sees admins from all their schools
      const accessibleIds = await getAccessibleSchoolIds(user_id, schoolId);
      query = query.in("school_id", accessibleIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error("Error fetching admins:", err);
    res.status(500).json({ error: err.message || "Failed to fetch admins" });
  }
});

/**
 * PUT /api/users/:userId/permissions
 * Update delegated permissions for an admin
 */
router.put("/:userId/permissions", requireRoles("director", "superadmin"), async (req, res) => {
  try {
    const { schoolId, role, user_id } = req.user;
    const { delegated_permissions } = req.body;

    if (!Array.isArray(delegated_permissions)) {
      return res.status(400).json({ error: "delegated_permissions must be an array" });
    }

    // Verify the target user is an admin
    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("user_id, school_id, role")
      .eq("user_id", req.params.userId)
      .eq("is_deleted", false)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.role !== "admin") {
      return res.status(400).json({ error: "Can only delegate permissions to admin role" });
    }

    // Director can only manage admins in their accessible schools
    if (role === "director") {
      const accessibleIds = await getAccessibleSchoolIds(user_id, schoolId);
      if (!accessibleIds.includes(targetUser.school_id)) {
        return res.status(403).json({ error: "You don't have access to this admin's school" });
      }
    }

    // Update delegated permissions
    const { error: updateError } = await supabase
      .from("users")
      .update({ delegated_permissions })
      .eq("user_id", req.params.userId);

    if (updateError) throw updateError;

    res.json({ updated: true });
  } catch (err) {
    console.error("Error updating permissions:", err);
    res.status(500).json({ error: err.message || "Failed to update permissions" });
  }
});

/**
 * GET /api/users/:userId/permissions
 * Get delegated permissions for a specific user
 */
router.get("/:userId/permissions", authRequired, async (req, res) => {
  try {
    const { schoolId, role, user_id } = req.user;

    // Users can only view their own permissions, or directors can view any admin's
    if (req.params.userId !== user_id && role !== "director" && role !== "superadmin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("delegated_permissions")
      .eq("user_id", req.params.userId)
      .eq("is_deleted", false)
      .single();

    if (error) throw error;

    res.json({ delegated_permissions: data?.delegated_permissions || [] });
  } catch (err) {
    console.error("Error fetching permissions:", err);
    res.status(500).json({ error: err.message || "Failed to fetch permissions" });
  }
});

// Helper function to get accessible school IDs (for directors)
async function getAccessibleSchoolIds(userId, schoolId) {
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (!user) return [schoolId];

  if (user.role === "director" || user.role === "superadmin") {
    const { data: allSchools } = await supabase
      .from("schools")
      .select("school_id")
      .eq("is_deleted", false);
    return allSchools?.map(s => s.school_id) || [schoolId];
  }

  return [schoolId];
}

export default router;
