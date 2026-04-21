/**
 * Branch Privacy Utilities
 * Ensures parents never see branch/campus information
 * 100% ADDITIVE - No existing code modified
 */

/**
 * Get current user role from localStorage
 */
export function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.role || null;
  } catch {
    return null;
  }
}

/**
 * Check if current user is a parent or student
 */
export function isParentOrStudent() {
  const role = getCurrentUserRole();
  return role === "parent" || role === "student";
}

/**
 * Check if current user can see branch information
 */
export function canSeeBranchInfo() {
  const role = getCurrentUserRole();
  return role === "admin" || role === "finance" || role === "teacher" || role === "superadmin";
}

/**
 * Sanitize school name to hide branch info from parents
 * Example: "Greenfield Academy (Nairobi)" → "Greenfield Academy"
 */
export function sanitizeSchoolName(name) {
  if (!name || typeof name !== "string") return name;
  
  // Parents see clean name without branch suffix
  if (isParentOrStudent()) {
    // Remove common branch suffixes like "(Nairobi)", "- Nairobi", "(Branch)"
    return name
      .replace(/\s*\([^)]+\)\s*$/g, "") // Remove (anything) at end
      .replace(/\s*-\s*\w+\s*$/g, "")    // Remove "- word" at end
      .replace(/\s*Branch\s*$/gi, "")     // Remove "Branch" at end
      .trim();
  }
  
  return name; // Staff see full name
}

/**
 * Sanitize school object to hide branch fields from parents
 */
export function sanitizeSchool(school) {
  if (!school) return school;
  
  if (isParentOrStudent()) {
    // Return clean school object without branch info
    return {
      school_id: school.school_id,
      name: sanitizeSchoolName(school.name),
      code: school.code,
      email: school.email,
      phone: school.phone,
      address: school.address,
      county: school.county,
      country: school.country,
      // NO is_branch, NO parent_school_id, NO branch_code
      is_branch: false, // Always appear as main school
      parent_school_id: null,
      branch_code: null,
      branch_address: null,
      branch_phone: null
    };
  }
  
  return school; // Staff see everything
}

/**
 * Hook to get branch-aware school display
 */
export function useSchoolDisplay() {
  const canSeeBranches = canSeeBranchInfo();
  const isRestricted = isParentOrStudent();
  
  return {
    canSeeBranches,
    isRestricted,
    sanitizeSchoolName,
    sanitizeSchool
  };
}

export default {
  getCurrentUserRole,
  isParentOrStudent,
  canSeeBranchInfo,
  sanitizeSchoolName,
  sanitizeSchool,
  useSchoolDisplay
};
