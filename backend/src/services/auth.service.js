import '../config/env.js';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabaseClient.js';
import { resolvePasswordPolicy, validatePassword } from '../middleware/passwordPolicy.js';
import { logActivity } from '../helpers/activity.logger.js';

/**
 * Single-source-of-truth auth service
 * Password hashes live in public.users.password_hash
 * Login and change-password both read/write this column primarily.
 * private.user_credentials is checked for must_change_password flag.
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

    // 4. Check must_change_password flag from private.user_credentials
    const { data: cred, error: credError } = await supabase
      .from('user_credentials')
      .select('must_change_password')
      .eq('user_id', user.user_id)
      .single();

    if (credError && credError.code !== 'PGRST116') {
      console.error('Auth service: error fetching user_credentials:', credError.message);
    }

    const mustChangePassword = cred?.must_change_password === true;

    // 5. If user must change password, return requires_password_change flag
    if (mustChangePassword) {
      // Log forced password reset initiation
      try {
        await logActivity(
          null,
          { action: "auth.password_reset_forced", userId: user.user_id, description: "Password reset forced by policy violation" }
        );
      } catch (e) {
        // logActivity is fire-and-forget; don't break login flow
      }
      return {
        requires_password_change: true,
        user_id: user.user_id,
        school_id: user.school_id,
      };
    }

    // 6. Check password policy compliance for existing valid password
    //    If the password doesn't meet the current policy, force a change
    const policy = await getSchoolPasswordPolicy(schoolId);
    const validation = validatePassword(password, {
      email: user.email,
      firstName: user.full_name,
    }, policy);

    if (!validation.valid) {
      // Password is valid (hash matches) but doesn't comply with current policy
      // Force password change on next login
      // Mark user for password reset
      await supabase
        .from('private.user_credentials')
        .update({ must_change_password: true })
        .eq('user_id', user.user_id);

      // Log password policy violation
      try {
        await logActivity(
          null,
          { action: "auth.password_policy_violation", userId: user.user_id, description: "Password does not meet current policy", details: validation.errors }
        );
      } catch (e) {
        // logActivity is fire-and-forget; don't break login flow
      }

      return {
        requires_password_change: true,
        user_id: user.user_id,
        school_id: user.school_id,
        policyViolation: validation.errors,
      };
    }

    // 7. Return full user object needed by login handler
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