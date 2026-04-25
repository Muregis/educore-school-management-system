/**
 * Parent-Student Relationship Service
 * 
 * Bridges old (users.student_id) and new (student_parent_mapping) patterns.
 * Provides safe migration path without breaking existing functionality.
 * 
 * This service:
 * 1. Tries new mapping table first (student_parent_mapping)
 * 2. Falls back to old pattern (users.student_id) for backward compatibility
 * 3. Handles multiple parents per student
 * 4. Enforces proper access control
 */

import { apiFetch } from '../lib/api';

// Cache for parent-student relationships
const relationshipCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all students linked to a parent user
 * Tries mapping table first, falls back to legacy pattern
 * 
 * @param {string} parentUserId - The parent's user ID
 * @param {string} token - Auth token
 * @returns {Promise<Array>} Array of student objects with access permissions
 */
export async function getStudentsForParent(parentUserId, token) {
  if (!parentUserId || !token) {
    return [];
  }

  const cacheKey = `parent_${parentUserId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Method 1: Try new mapping table (preferred)
    const mappingResult = await fetchFromMappingTable(parentUserId, token);
    
    if (mappingResult && mappingResult.length > 0) {
      setCached(cacheKey, mappingResult);
      return mappingResult;
    }

    // Method 2: Fall back to legacy users.student_id pattern
    const legacyResult = await fetchFromLegacyPattern(parentUserId, token);
    
    if (legacyResult && legacyResult.length > 0) {
      setCached(cacheKey, legacyResult);
      return legacyResult;
    }

    return [];

  } catch (err) {
    console.error('Error fetching students for parent:', err);
    return [];
  }
}

/**
 * Get all parents linked to a student
 * 
 * @param {string} studentId - The student's ID
 * @param {string} token - Auth token
 * @returns {Promise<Array>} Array of parent user objects
 */
export async function getParentsForStudent(studentId, token) {
  if (!studentId || !token) {
    return [];
  }

  const cacheKey = `student_${studentId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Try new mapping table first
    const result = await apiFetch(`/students/${studentId}/parents`, { token });
    
    if (result && (result.data || result).length > 0) {
      const parents = normalizeParentData(result.data || result);
      setCached(cacheKey, parents);
      return parents;
    }

    // Fallback: try to find via legacy pattern
    const legacyResult = await apiFetch(`/users?student_id=${studentId}&role=parent`, { token });
    
    if (legacyResult && (legacyResult.data || legacyResult).length > 0) {
      const parents = normalizeParentData(legacyResult.data || legacyResult);
      setCached(cacheKey, parents);
      return parents;
    }

    return [];

  } catch (err) {
    console.error('Error fetching parents for student:', err);
    return [];
  }
}

/**
 * Check if a parent has access to a specific student
 * 
 * @param {string} parentUserId - The parent's user ID
 * @param {string} studentId - The student's ID to check
 * @param {string} token - Auth token
 * @param {string} accessType - Type of access: 'view', 'edit', 'fees', 'grades', 'attendance'
 * @returns {Promise<boolean>} True if parent has access
 */
export async function parentHasAccessToStudent(
  parentUserId, 
  studentId, 
  token, 
  accessType = 'view'
) {
  if (!parentUserId || !studentId || !token) {
    return false;
  }

  try {
    const students = await getStudentsForParent(parentUserId, token);
    const student = students.find(s => 
      String(s.student_id || s.id) === String(studentId)
    );

    if (!student) {
      return false;
    }

    // Check specific permission if available
    switch (accessType) {
      case 'grades':
        return student.can_view_grades !== false;
      case 'fees':
        return student.can_view_fees !== false;
      case 'attendance':
        return student.can_view_attendance !== false;
      case 'payments':
        return student.can_make_payments !== false;
      case 'edit':
        // Parents generally can't edit student data
        return false;
      case 'view':
      default:
        return true;
    }

  } catch (err) {
    console.error('Error checking parent access:', err);
    return false;
  }
}

/**
 * Link a parent to a student (creates mapping record)
 * 
 * @param {Object} params - Link parameters
 * @param {string} params.studentId - Student ID
 * @param {string} params.parentUserId - Parent user ID
 * @param {string} params.relationship - Relationship type: 'father', 'mother', 'guardian', 'other'
 * @param {boolean} params.isPrimary - Is this the primary contact
 * @param {Object} params.permissions - Permission overrides
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Created mapping record
 */
export async function linkParentToStudent({
  studentId,
  parentUserId,
  relationship = 'guardian',
  isPrimary = false,
  permissions = {}
}, token) {
  if (!studentId || !parentUserId || !token) {
    throw new Error('Missing required parameters');
  }

  const payload = {
    student_id: studentId,
    parent_user_id: parentUserId,
    relationship,
    is_primary: isPrimary,
    can_view_grades: permissions.canViewGrades ?? true,
    can_view_fees: permissions.canViewFees ?? true,
    can_view_attendance: permissions.canViewAttendance ?? true,
    can_make_payments: permissions.canMakePayments ?? true
  };

  try {
    const result = await apiFetch('/student-parent-mappings', {
      method: 'POST',
      body: payload,
      token
    });

    // Clear caches
    clearCache(`parent_${parentUserId}`);
    clearCache(`student_${studentId}`);

    return result;

  } catch (err) {
    console.error('Error linking parent to student:', err);
    throw err;
  }
}

/**
 * Update parent permissions for a student
 * 
 * @param {string} mappingId - The mapping record ID
 * @param {Object} permissions - Updated permissions
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Updated mapping
 */
export async function updateParentPermissions(mappingId, permissions, token) {
  if (!mappingId || !token) {
    throw new Error('Missing required parameters');
  }

  try {
    const result = await apiFetch(`/student-parent-mappings/${mappingId}`, {
      method: 'PUT',
      body: permissions,
      token
    });

    // Clear all caches since we don't know which parent/student this affects
    clearAllCache();

    return result;

  } catch (err) {
    console.error('Error updating parent permissions:', err);
    throw err;
  }
}

/**
 * Remove parent-student link
 * 
 * @param {string} mappingId - The mapping record ID
 * @param {string} token - Auth token
 * @returns {Promise<boolean>} Success status
 */
export async function unlinkParentFromStudent(mappingId, token) {
  if (!mappingId || !token) {
    throw new Error('Missing required parameters');
  }

  try {
    await apiFetch(`/student-parent-mappings/${mappingId}`, {
      method: 'DELETE',
      token
    });

    clearAllCache();
    return true;

  } catch (err) {
    console.error('Error unlinking parent from student:', err);
    throw err;
  }
}

/**
 * Migrate legacy parent links to new mapping table
 * This is a one-time migration operation
 * 
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Migration results
 */
export async function migrateLegacyParentLinks(token) {
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    // Call backend migration endpoint
    const result = await apiFetch('/admin/migrate-parent-links', {
      method: 'POST',
      token
    });

    clearAllCache();
    return result;

  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

// ==================== INTERNAL HELPERS ====================

/**
 * Fetch from new student_parent_mapping table
 */
async function fetchFromMappingTable(parentUserId, token) {
  try {
    const result = await apiFetch(`/users/${parentUserId}/students`, { token });
    
    if (!result) return [];
    
    const data = result.data || result;
    
    return data.map(item => ({
      student_id: item.student_id || item.studentId,
      id: item.student_id || item.studentId,
      first_name: item.first_name || item.firstName,
      last_name: item.last_name || item.lastName,
      class_name: item.class_name || item.className,
      admission_number: item.admission_number || item.admissionNumber,
      relationship: item.relationship || 'guardian',
      is_primary: item.is_primary || item.isPrimary || false,
      can_view_grades: item.can_view_grades ?? item.canViewGrades ?? true,
      can_view_fees: item.can_view_fees ?? item.canViewFees ?? true,
      can_view_attendance: item.can_view_attendance ?? item.canViewAttendance ?? true,
      can_make_payments: item.can_make_payments ?? item.canMakePayments ?? true,
      _source: 'mapping_table'
    }));

  } catch (err) {
    // Return empty array to trigger fallback
    return [];
  }
}

/**
 * Fetch from legacy users.student_id pattern
 */
async function fetchFromLegacyPattern(parentUserId, token) {
  try {
    // Get the parent's user record
    const userResult = await apiFetch(`/users/${parentUserId}`, { token });
    
    if (!userResult) return [];
    
    const user = userResult.data || userResult;
    
    // If user has student_id, fetch that student
    if (user.student_id || user.studentId) {
      const studentResult = await apiFetch(
        `/students/${user.student_id || user.studentId}`, 
        { token }
      );
      
      if (studentResult) {
        const student = studentResult.data || studentResult;
        return [{
          student_id: student.student_id || student.id,
          id: student.student_id || student.id,
          first_name: student.first_name || student.firstName,
          last_name: student.last_name || student.lastName,
          class_name: student.class_name || student.className,
          admission_number: student.admission_number || student.admissionNumber,
          relationship: 'guardian',
          is_primary: true,
          can_view_grades: true,
          can_view_fees: true,
          can_view_attendance: true,
          can_make_payments: true,
          _source: 'legacy_pattern'
        }];
      }
    }

    return [];

  } catch (err) {
    return [];
  }
}

/**
 * Normalize parent data from various formats
 */
function normalizeParentData(data) {
  if (!Array.isArray(data)) data = [data];
  
  return data.map(item => ({
    user_id: item.user_id || item.userId || item.id,
    id: item.user_id || item.userId || item.id,
    first_name: item.first_name || item.firstName,
    last_name: item.last_name || item.lastName,
    email: item.email,
    phone: item.phone || item.phone_number || item.phoneNumber,
    relationship: item.relationship || 'guardian',
    is_primary: item.is_primary || item.isPrimary || false
  }));
}

// ==================== CACHE MANAGEMENT ====================

function getCached(key) {
  const cached = relationshipCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  relationshipCache.delete(key);
  return null;
}

function setCached(key, data) {
  relationshipCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

function clearCache(key) {
  relationshipCache.delete(key);
}

function clearAllCache() {
  relationshipCache.clear();
}

// Clear cache on window focus (in case of changes in other tabs)
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    clearAllCache();
  });
}

export default {
  getStudentsForParent,
  getParentsForStudent,
  parentHasAccessToStudent,
  linkParentToStudent,
  updateParentPermissions,
  unlinkParentFromStudent,
  migrateLegacyParentLinks
};
