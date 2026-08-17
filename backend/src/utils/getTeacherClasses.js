import { env } from "../config/env.js";
import { supabase } from "../config/supabaseClient.js";
import { pgPool } from "../config/pg.js";

const isLocalMode = env.databaseMode === "local";

export async function getTeacherAssignedClasses(schoolId, userId) {
  if (isLocalMode) {
    const result = await pgPool.query(
      `SELECT class_name FROM teacher_class_assignments
       WHERE school_id = $1 AND teacher_id = $2 AND is_active = true`,
      [schoolId, userId]
    );
    return [...new Set(result.rows.map(r => r.class_name))];
  }

  const { data, error } = await supabase
    .from('teacher_class_assignments')
    .select('class_name')
    .eq('school_id', schoolId)
    .eq('teacher_id', userId)
    .eq('is_active', true);

  if (error) throw error;
  return [...new Set((data || []).map(c => c.class_name))];
}
