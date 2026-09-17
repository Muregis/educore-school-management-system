import '../config/env.js';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabaseClient.js';

/**
 * Supabase-only authentication service
 * All authentication queries use Supabase PostgreSQL with RLS policies
 * Password hashes are stored in private.user_credentials, not public.users
 */
export async function authLogin(email, password, schoolId = 1) {
  try {
    // Read password hash from private.user_credentials, not public.users
    const { data: creds, error: credError } = await supabase
      .from('private.user_credentials')
      .select('password_hash, token_version, failed_login_attempts, locked_until')
      .eq('user_id', email)  // assuming email maps to user_id, or adjust as needed
      .eq('school_id', schoolId)
      .single();
    
    if (credError || !creds) {
      // Fallback: try public.users for backward compatibility during migration
      const { data: users, error } = await supabase
        .from('users')
        .select('user_id, full_name, email, password_hash, role, status')
        .ilike('email', email)
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .limit(1);
      
      if (error || !users || users.length === 0) {
        return null;
      }
      
      const user = users[0];
      // During migration period, verify against public.users.password_hash
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) return null;
      
      // Migrate user to private.user_credentials (idempotent)
      await supabase
        .from('private.user_credentials')
        .insert({
          user_id: user.user_id,
          school_id: user.school_id,
          password_hash: user.password_hash,
          password_changed_at: user.password_changed_at,
          token_version: 0,
          failed_login_attempts: 0,
          locked_until: null,
        })
        .onConflict('user_id')
        .doNothing();
      
      // Return using the new credential store for future logins
      return { user: { ...user, source: 'migrated' }, source: 'migrated' };
    }
    
    const user = { user_id: creds.user_id, school_id: creds.school_id };

    // Check lockout before proceeding
    if (creds.locked_until && new Date(creds.locked_until) > new Date()) {
      return { locked: true, userId: creds.user_id, lockedUntil: creds.locked_until };
    }

    // Verify password against stored hash
    const isValidPassword = await bcrypt.compare(password, creds.password_hash);
    if (!isValidPassword) {
      // Increment failed login attempts
      await supabase
        .from('private.user_credentials')
        .update({ failed_login_attempts: creds.failed_login_attempts + 1 })
        .eq('user_id', creds.user_id);
      
      return null;
    }

    // Reset failed login attempts on successful authentication
    await supabase
      .from('private.user_credentials')
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq('user_id', creds.user_id);

    return { user, source: 'private.credentials' };
} catch (err) {
    console.error('Auth service error:', err.message);
    return null;
  }
}

console.log('✅ Supabase auth service ready');
console.log('🔒 All authentication via Supabase PostgreSQL with RLS');