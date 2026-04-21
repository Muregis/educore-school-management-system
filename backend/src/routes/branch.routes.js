/**
 * Branch/Campus API Routes
 * 100% ADDITIVE - New file, no existing routes modified
 */

import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import {
  getBranches,
  getSchoolWithBranches,
  canAccessBranches,
  getAccessibleSchoolIds,
  createBranch
} from "../services/branch.service.js";
import { supabase } from "../config/supabaseClient.js";

const router = Router();

/**
 * Helper: Sanitize branch data to hide branch info from parents
 */
function sanitizeForParents(data, role) {
  if (role === "parent" || role === "student") {
    // Parents/students see school as normal - no branch info
    return {
      school: {
        school_id: data.school?.school_id,
        name: data.school?.name?.replace(/\s*\([^)]+\)$/, ""), // Remove (Branch) suffix
        code: data.school?.code,
        email: data.school?.email,
        phone: data.school?.phone,
        address: data.school?.address,
        county: data.school?.county,
        country: data.school?.country
        // NO is_branch, NO parent_school_id, NO branch_code
      },
      branches: [], // Empty - parents don't see other branches
      is_branch: false, // Always false to parents
      parent_school: null,
      sibling_branches: []
    };
  }
  return data; // Staff see full data
}

/**
 * GET /api/branches/my-branches
 * Get branches for the current user's school
 * DIRECTOR: Returns all schools in system
 * PARENTS: Returns sanitized data hiding branch structure
 */
router.get("/my-branches", authRequired, async (req, res) => {
  try {
    const { school_id, role, user_id } = req.user;
    
    if (!school_id) {
      return res.status(400).json({ error: "No school context" });
    }
    
    // Parents cannot access branch info
    if (role === "parent" || role === "student") {
      return res.status(403).json({ 
        error: "Branch access not available",
        school: { school_id }
      });
    }
    
    // Director/Superadmin sees ALL schools
    if (role === "director" || role === "superadmin") {
      const { data: allSchools, error } = await supabase
        .from("schools")
        .select("school_id, name, code, is_branch, parent_school_id, branch_code, email, phone, address, county, subscription_status")
        .eq("is_deleted", false)
        .order("school_id", { ascending: true });
      
      if (error) throw error;
      
      return res.json({
        role: role,
        allSchools: allSchools || [],
        totalSchools: allSchools?.length || 0,
        canManageAll: true
      });
    }
    
    // Regular admin - get their school + branches
    const schoolWithBranches = await getSchoolWithBranches(school_id);
    
    if (!schoolWithBranches) {
      return res.status(404).json({ error: "School not found" });
    }
    
    const responseData = {
      school: schoolWithBranches,
      branches: schoolWithBranches.branches || [],
      is_branch: schoolWithBranches.is_branch,
      parent_school: schoolWithBranches.parent_school || null,
      sibling_branches: schoolWithBranches.sibling_branches || []
    };
    
    res.json(sanitizeForParents(responseData, role));
  } catch (err) {
    console.error("Error fetching branches:", err);
    res.status(500).json({ error: err.message || "Failed to fetch branches" });
  }
});

/**
 * GET /api/branches/:schoolId
 * Get branches for a specific school (admin/director can view all their schools)
 */
router.get("/:schoolId", authRequired, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { role, school_id: userSchoolId, user_id } = req.user;
    
    // Parents/students cannot access
    if (role === "parent" || role === "student") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    // Superadmin can view any school
    if (role === "superadmin") {
      const schoolWithBranches = await getSchoolWithBranches(Number(schoolId));
      if (!schoolWithBranches) {
        return res.status(404).json({ error: "School not found" });
      }
      return res.json(schoolWithBranches);
    }
    
    // Admin/Director/Finance can view schools they have access to
    // Check if they can access this school (same school, branch, or sibling)
    const accessibleIds = await getAccessibleSchoolIds(user_id, userSchoolId);
    
    if (!accessibleIds.includes(Number(schoolId))) {
      return res.status(403).json({ 
        error: "You don't have access to this school",
        accessibleSchools: accessibleIds
      });
    }
    
    const schoolWithBranches = await getSchoolWithBranches(Number(schoolId));
    
    if (!schoolWithBranches) {
      return res.status(404).json({ error: "School not found" });
    }
    
    res.json(schoolWithBranches);
  } catch (err) {
    console.error("Error fetching school branches:", err);
    res.status(500).json({ error: err.message || "Failed to fetch school branches" });
  }
});

/**
 * POST /api/branches
 * Create a new branch (admin only)
 */
router.post("/", authRequired, async (req, res) => {
  try {
    const { role, school_id } = req.user;
    const { name, branch_code, branch_address, branch_phone, branch_manager_id, email, phone, county } = req.body;
    
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Only admins can create branches" });
    }
    
    if (!name || !branch_code) {
      return res.status(400).json({ error: "name and branch_code are required" });
    }
    
    const parentSchoolId = role === "superadmin" ? (req.body.parent_school_id || school_id) : school_id;
    
    const branch = await createBranch(parentSchoolId, {
      name,
      branch_code,
      branch_address,
      branch_phone,
      branch_manager_id,
      email,
      phone,
      county
    });
    
    res.status(201).json({
      message: "Branch created successfully",
      branch
    });
  } catch (err) {
    console.error("Error creating branch:", err);
    res.status(500).json({ error: err.message || "Failed to create branch" });
  }
});

/**
 * GET /api/branches/can-access
 * Check if current user can access multi-branch features
 * PARENTS: Always returns false
 */
router.get("/can-access", authRequired, async (req, res) => {
  try {
    const { user_id, school_id, role } = req.user;
    
    // Parents never see branch features
    if (role === "parent" || role === "student") {
      return res.json({ canAccess: false, reason: "Not available" });
    }
    
    if (!school_id) {
      return res.json({ canAccess: false, reason: "No school context" });
    }
    
    const canAccess = await canAccessBranches(user_id, school_id);
    
    res.json({
      canAccess,
      userSchoolId: school_id
    });
  } catch (err) {
    console.error("Error checking branch access:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/branches/accessible-ids
 * Get all school IDs the user can access (for cross-branch queries)
 * PARENTS: Blocked - only see their own school
 */
router.get("/accessible-ids", authRequired, async (req, res) => {
  try {
    const { user_id, school_id, role } = req.user;
    
    // Parents only see their own school ID
    if (role === "parent" || role === "student") {
      return res.json({
        schoolIds: school_id ? [school_id] : [],
        currentSchoolId: school_id
      });
    }
    
    if (!school_id) {
      return res.json({ schoolIds: [] });
    }
    
    const schoolIds = await getAccessibleSchoolIds(user_id, school_id);
    
    res.json({
      schoolIds,
      currentSchoolId: school_id
    });
  } catch (err) {
    console.error("Error getting accessible school IDs:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/branches/switch/:branchId
 * Switch to a different branch (set context)
 * PARENTS: Blocked - cannot switch branches
 */
router.put("/switch/:branchId", authRequired, async (req, res) => {
  try {
    const { branchId } = req.params;
    const { user_id, school_id: currentSchoolId, role } = req.user;
    
    // Parents cannot switch branches
    if (role === "parent" || role === "student") {
      return res.status(403).json({ 
        error: "Branch switching not available"
      });
    }
    
    // Get accessible schools
    const accessibleIds = await getAccessibleSchoolIds(user_id, currentSchoolId);
    
    if (!accessibleIds.includes(Number(branchId))) {
      return res.status(403).json({ 
        error: "You don't have access to this branch",
        accessibleBranches: accessibleIds
      });
    }
    
    // Get the branch details
    const { data: branch, error } = await supabase
      .from("schools")
      .select("school_id, name, code, is_branch, parent_school_id, branch_code")
      .eq("school_id", branchId)
      .eq("is_deleted", false)
      .maybeSingle();
    
    if (error) throw error;
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }
    
    res.json({
      message: "Branch context switched",
      newSchoolId: branch.school_id,
      newSchool: branch,
      note: "Frontend should update JWT/storage with new school_id"
    });
  } catch (err) {
    console.error("Error switching branch:", err);
    res.status(500).json({ error: err.message || "Failed to switch branch" });
  }
});

export default router;
