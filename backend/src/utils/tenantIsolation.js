/**
 * Pure tenant-isolation helpers. Used by routes and unit tests.
 * Does not touch the database.
 */

/**
 * True when the resource belongs to the caller's school.
 * @param {number|string|null|undefined} resourceSchoolId
 * @param {number|string|null|undefined} callerSchoolId
 */
export function belongsToTenant(resourceSchoolId, callerSchoolId) {
  if (resourceSchoolId == null || callerSchoolId == null) return false;
  return String(resourceSchoolId) === String(callerSchoolId);
}

/**
 * Filter an array of rows to the caller's school only.
 * @template T
 * @param {T[]} rows
 * @param {number|string} callerSchoolId
 * @param {keyof T | string} [schoolIdKey='school_id']
 * @returns {T[]}
 */
export function filterRowsToTenant(rows, callerSchoolId, schoolIdKey = "school_id") {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => belongsToTenant(row?.[schoolIdKey], callerSchoolId));
}

/**
 * Reject cross-tenant access. Returns null if allowed, or an error descriptor.
 */
export function assertSameTenant(resourceSchoolId, callerSchoolId) {
  if (belongsToTenant(resourceSchoolId, callerSchoolId)) return null;
  return {
    status: 403,
    code: "TENANT_FORBIDDEN",
    message: "Resource does not belong to this school",
  };
}
