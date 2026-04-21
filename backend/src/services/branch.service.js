/**
 * Branch/Campus Service
 * Handles multi-branch school operations
 * 100% ADDITIVE - No existing code modified
 */

import { supabase } from "../config/supabaseClient.js";

/**
 * Get all branches for a parent school
 */
export async function getBranches(parentSchoolId) {
  if (!parentSchoolId) return [];
  
  const { data, error } = await supabase
    .from("schools")
    .select("school_id, name, code, branch_code, branch_address, branch_phone, is_branch, parent_school_id, email, phone, address, county")
    .eq("parent_school_id", parentSchoolId)
    .eq("is_branch", true)
    .eq("is_deleted", false)
    .order("branch_code", { ascending: true });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get main school + all branches (for superadmin/dashboard views)
 */
export async function getSchoolWithBranches(schoolId) {
  if (!schoolId) return null;
  
  // Get the school (could be main or branch)
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("school_id, name, code, branch_code, branch_address, branch_phone, is_branch, parent_school_id, email, phone, address, county, country, subscription_status")
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .maybeSingle();
  
  if (schoolError) throw schoolError;
  if (!school) return null;
  
  // If this is a branch, get the parent
  if (school.is_branch && school.parent_school_id) {
    const { data: parent } = await supabase
      .from("schools")
      .select("school_id, name, code")
      .eq("school_id", school.parent_school_id)
      .eq("is_deleted", false)
      .maybeSingle();
    
    school.parent_school = parent || null;
    
    // Get sibling branches
    const siblings = await getBranches(school.parent_school_id);
    school.sibling_branches = siblings.filter(b => b.school_id !== schoolId);
  } else {
    // This is a main school - get its branches
    school.branches = await getBranches(schoolId);
  }
  
  return school;
}

/**
 * Check if user can access data from multiple branches
 * Used for cross-branch reporting
 */
export async function canAccessBranches(userId, schoolId) {
  if (!userId || !schoolId) return false;
  
  // Get user's role
  const { data: user, error } = await supabase
    .from("users")
    .select("role, school_id")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .maybeSingle();
  
  if (error || !user) return false;
  
  // Director/Superadmin can access ALL schools
  if (user.role === "director" || user.role === "superadmin") {
    return true;
  }
  
  // Admin, finance can access their school's branches
  const allowedRoles = ["admin", "finance"];
  if (!allowedRoles.includes(user.role)) return false;
  
  // Check if this school has branches or is a branch
  const schoolWithBranches = await getSchoolWithBranches(schoolId);
  if (!schoolWithBranches) return false;
  
  const hasBranches = (schoolWithBranches.branches?.length > 0) || 
                      (schoolWithBranches.parent_school_id);
  
  return hasBranches;
}

/**
 * Get all school IDs the user can access (for cross-branch queries)
 * DIRECTOR: Returns ALL school IDs in the system
 */
export async function getAccessibleSchoolIds(userId, schoolId) {
  if (!userId || !schoolId) return [schoolId];
  
  // Get user's role
  const { data: user, error } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .maybeSingle();
  
  if (error || !user) return [schoolId];
  
  // Director/Superadmin can access ALL schools
  if (user.role === "director" || user.role === "superadmin") {
    const { data: allSchools, error: schoolsError } = await supabase
      .from("schools")
      .select("school_id")
      .eq("is_deleted", false);
    
    if (schoolsError) return [schoolId];
    return allSchools?.map(s => s.school_id) || [schoolId];
  }
  
  // Regular admin - check if can access branches
  const canAccess = await canAccessBranches(userId, schoolId);
  if (!canAccess) return [schoolId];
  
  const school = await getSchoolWithBranches(schoolId);
  if (!school) return [schoolId];
  
  const ids = [schoolId];
  
  if (school.is_branch && school.parent_school_id) {
    // Include parent and siblings
    ids.push(school.parent_school_id);
    school.sibling_branches?.forEach(b => ids.push(b.school_id));
  } else if (school.branches?.length > 0) {
    // Include all branches
    school.branches.forEach(b => ids.push(b.school_id));
  }
  
  return [...new Set(ids)]; // Remove duplicates
}

/**
 * Format branch display name
 */
export function formatBranchName(school) {
  if (!school) return "";
  if (school.is_branch && school.branch_code) {
    return `${school.name} (${school.branch_code})`;
  }
  return school.name;
}

/**
 * Create a new branch for a parent school
 */
export async function createBranch(parentSchoolId, branchData) {
  if (!parentSchoolId || !branchData.name || !branchData.branch_code) {
    throw new Error("parentSchoolId, name, and branch_code are required");
  }
  
  // Verify parent exists
  const { data: parent, error: parentError } = await supabase
    .from("schools")
    .select("school_id, name")
    .eq("school_id", parentSchoolId)
    .eq("is_deleted", false)
    .eq("is_branch", false) // Parent must be a main school
    .maybeSingle();
  
  if (parentError) throw parentError;
  if (!parent) throw new Error("Parent school not found or is itself a branch");
  
  // Check branch_code is unique for this parent
  const { data: existing } = await supabase
    .from("schools")
    .select("school_id")
    .eq("parent_school_id", parentSchoolId)
    .eq("branch_code", branchData.branch_code)
    .eq("is_deleted", false)
    .maybeSingle();
  
  if (existing) {
    throw new Error(`Branch code '${branchData.branch_code}' already exists for this school`);
  }
  
  const { data, error } = await supabase
    .from("schools")
    .insert({
      name: branchData.name,
      code: `${parent.code}-${branchData.branch_code.toUpperCase()}`,
      parent_school_id: parentSchoolId,
      is_branch: true,
      branch_code: branchData.branch_code,
      branch_address: branchData.branch_address || null,
      branch_phone: branchData.branch_phone || null,
      branch_manager_id: branchData.branch_manager_id || null,
      email: branchData.email || parent.email,
      phone: branchData.phone || parent.phone,
      address: branchData.address || null,
      county: branchData.county || parent.county,
      country: branchData.country || parent.country || "Kenya",
      subscription_status: "active"
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export default {
  getBranches,
  getSchoolWithBranches,
  canAccessBranches,
  getAccessibleSchoolIds,
  formatBranchName,
  createBranch
};
