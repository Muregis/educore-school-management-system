import '../config/env.js';
import { database, supabase } from '../config/db.js';

// Supabase-only authentication service (MySQL disabled)
export async function hybridAuthLogin(email, password, schoolId = 1) {
  // Use Supabase only
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, full_name, email, password_hash, role, status')
      .eq('email', email)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .limit(1);
    
    if (!error && users && users.length > 0) {
      return { user: users[0], source: 'supabase' };
    }
  } catch (err) {
    console.error('Supabase auth failed:', err.message);
  }
  
  // OLD: MySQL fallback (commented for safety)
  // try {
  //   const [rows] = await mysqlPool.query(
  //     `SELECT user_id, full_name, email, password_hash, role, status
  //      FROM users
  //      WHERE email = ? AND school_id = ? AND is_deleted = 0 LIMIT 1`,
  //     [email, schoolId]
  //   );
    
  //   if (rows.length > 0) {
  //     return { user: rows[0], source: 'mysql' };
  //   }
  // } catch (err) {
  //   console.log('MySQL auth also failed');
  // }
  
  return null;
}

// Migration function to gradually move users to Supabase
export async function migrateUserToSupabase(mysqlUser) {
  try {
    const { error } = await supabase
      .from('users')
      .upsert([{
        user_id: mysqlUser.user_id,
        school_id: mysqlUser.school_id,
        full_name: mysqlUser.full_name,
        email: mysqlUser.email,
        password_hash: mysqlUser.password_hash,
        role: mysqlUser.role,
        status: mysqlUser.status,
        student_id: mysqlUser.student_id,
        is_deleted: Boolean(mysqlUser.is_deleted),
        created_at: mysqlUser.created_at,
        updated_at: mysqlUser.updated_at
      }], { onConflict: 'user_id' });
    
    return !error;
  } catch (err) {
    console.log('Migration to Supabase failed:', err.message);
    return false;
  }
}

console.log('✅ Hybrid auth service ready');
console.log('🔄 This allows gradual migration from MySQL to Supabase');
console.log('📊 Users authenticated via MySQL will be gradually migrated to Supabase');
