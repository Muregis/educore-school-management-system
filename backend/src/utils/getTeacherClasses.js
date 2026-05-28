import { supabase } from '../config/supabaseClient.js';

export async function getTeacherAssignedClasses(schoolId, userId) {
  const { data, error } = await supabase
    .from('teacher_class_assignments')
    .select('class_name')
    .eq('school_id', schoolId)
    .eq('teacher_id', userId)
    .eq('is_active', true);

  if (error) throw error;

  return [...new Set((data || []).map(c => c.class_name))];
}