import '../config/env.js';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabaseClient.js';

/**
 * Single-source-of-truth auth service
 * Password hashes live in public.users.password_hash
 * Login and change-password both read/write this column only.
 * No private.user_credentials dependency for login.
 */

export async function authLogin(email, password, schoolId = 1) {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Resolve user from public.users by email + school_id
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, school_id, full_name, email, role, status, is_deleted, password_hash')
      .ilike('email', normalizedEmail)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (error || !user) {
      return null; // safe: no stack trace leaked
    }

    // 2. Reject deleted / inactive accounts
    if (user.status !== 'active') {
      return null;
    }

    // 3. Verify password against the single store (public.users.password_hash)
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    // 4. Return full user object needed by login handler
    return {
      user: {
        user_id: user.user_id,
        school_id: user.school_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  } catch (err) {
    console.error('Auth service error:', err.message);
    return null;
  }
}