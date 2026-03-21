import '../config/env.js';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabaseClient.js';

/**
 * Supabase-only authentication service
 * All authentication queries use Supabase PostgreSQL with RLS policies
 */
export async function authLogin(email, password, schoolId = 1) {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, full_name, email, password_hash, role, status')
      .eq('email', email)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .limit(1);
    
    if (error) {
      console.error('Supabase auth query error:', error.message);
      return null;
    }
    
    if (!users || users.length === 0) {
      return null;
    }

    const user = users[0];

    // FIX: Verify password against stored hash
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }
    
    return { user, source: 'supabase' };
  } catch (err) {
    console.error('Auth service error:', err.message);
    return null;
  }
}

console.log('✅ Supabase auth service ready');
console.log('🔒 All authentication via Supabase PostgreSQL with RLS');