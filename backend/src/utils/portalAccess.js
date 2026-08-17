export function getUserStudentId(user) {
  return user?.student_id ?? user?.studentId ?? null;
}

export function isPortalRole(role) {
  return role === "parent" || role === "student";
}

export async function getPortalStudentIds(req, supabaseClient) {
  const role = req.user?.role;
  const schoolId = req.user?.school_id ?? req.user?.schoolId;
  const userId = req.user?.user_id ?? req.user?.userId;
  const tokenStudentId = getUserStudentId(req.user);

  if (!isPortalRole(role)) return null;
  if (!schoolId) return [];

  if (role === "student") {
    return tokenStudentId ? [Number(tokenStudentId)] : [];
  }

  // Parent role
  const { env } = await import("../config/env.js");
  if (env.databaseMode === "local") {
    // Local POC: basic parent lookup via users.student_id
    try {
      const result = await pgPool.query(
        "SELECT student_id FROM users WHERE user_id = $1 AND school_id = $2 AND role = 'parent' LIMIT 1",
        [userId, schoolId]
      );
      const primaryStudentId = result.rows[0]?.student_id;
      if (primaryStudentId) {
        return [Number(primaryStudentId)];
      }
    } catch (err) {
      console.error("[portalAccess] Local parent lookup failed:", err.message);
    }
    return [];
  }

  // Cloud mode
  const { data: userRow, error: userError } = await supabaseClient
    .from("users")
    .select("user_id, student_id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!userError && userRow) {
    const primaryStudentId = userRow.student_id ?? tokenStudentId;
    if (primaryStudentId) {
      return [Number(primaryStudentId)];
    }
  }

  return [];
}

export async function requirePortalStudentAccess(req, supabaseClient, studentId) {
  const allowedIds = await getPortalStudentIds(req, supabaseClient);
  if (allowedIds === null) return true;
  return allowedIds.map(String).includes(String(studentId));
}
