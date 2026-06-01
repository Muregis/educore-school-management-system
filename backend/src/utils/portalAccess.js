export function getUserStudentId(user) {
  return user?.student_id ?? user?.studentId ?? null;
}

export function isPortalRole(role) {
  return role === "parent" || role === "student";
}

export async function getPortalStudentIds(req, supabase) {
  const role = req.user?.role;
  const schoolId = req.user?.school_id ?? req.user?.schoolId;
  const userId = req.user?.user_id ?? req.user?.userId;
  const tokenStudentId = getUserStudentId(req.user);

  if (!isPortalRole(role)) return null;
  if (!schoolId) return [];

  if (role === "student") {
    return tokenStudentId ? [Number(tokenStudentId)] : [];
  }

  const ids = new Set();
  let linkedStudent = null;
  let parentUser = null;

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("user_id, student_id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!userError && userRow) parentUser = userRow;

  const primaryStudentId = parentUser?.student_id ?? tokenStudentId;
  if (primaryStudentId) {
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("student_id, parent_phone")
      .eq("student_id", primaryStudentId)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!studentError && student) {
      linkedStudent = student;
      ids.add(Number(student.student_id));
    }
  }

  if (linkedStudent?.parent_phone) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("students")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("parent_phone", linkedStudent.parent_phone)
      .eq("is_deleted", false);

    if (!siblingsError) {
      (siblings || []).forEach(student => ids.add(Number(student.student_id)));
    }
  }

  const { data: linkedRows, error: linkError } = await supabase
    .from("parent_students")
    .select("student_id, students!inner(school_id, is_deleted)")
    .eq("parent_id", userId)
    .eq("students.school_id", schoolId)
    .eq("students.is_deleted", false);

  if (!linkError) {
    (linkedRows || []).forEach(row => ids.add(Number(row.student_id)));
  }

  return [...ids].filter(id => Number.isFinite(id) && id > 0);
}

export async function requirePortalStudentAccess(req, supabase, studentId) {
  const allowedIds = await getPortalStudentIds(req, supabase);
  if (allowedIds === null) return true;
  return allowedIds.map(String).includes(String(studentId));
}
