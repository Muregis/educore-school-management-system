import '../config/env.js';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabaseClient.js';
import { resolvePasswordPolicy, validatePassword } from '../middleware/passwordPolicy.js';
import { getSchoolPasswordPolicy } from '../helpers/password-policy.helper.js';
import { logActivity } from '../helpers/activity.logger.js';

/**
 * Single-source-of-truth auth service
 * Password hashes live in public.users.password_hash (authoritative store for Option A).
 * Login and change-password both read/write this column primarily.
 * private.user_credentials is kept in sync only by the change-password flow.
 * School ID is required for policy lookups; if missing, it is resolved by email.
 */

export async function authLogin(email, password, schoolId = 1) {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Resolve schoolId if not provided (unique email → one school; many → schoolOptions)
    let effectiveSchoolId = schoolId;
    if (!schoolId) {
      const { data: users, error } = await supabase
        .from('users')
        .select('school_id')
        .ilike('email', normalizedEmail)
        .eq('is_deleted', false)
        .limit(5);
      if (error || !users || users.length === 0) {
        return null;
      }
      if (users.length === 1) {
        effectiveSchoolId = users[0].school_id;
      } else {
        // Many schools for this email — return null so frontend can show school selector
        return null;
      }
    }

    // Ensure effectiveSchoolId is a number
    effectiveSchoolId = Number(effectiveSchoolId);

    // 2. Resolve user from public.users by email + school_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, school_id, full_name, email, role, status, is_deleted, password_hash')
      .ilike('email', normalizedEmail)
      .eq('school_id', effectiveSchoolId)
      .eq('is_deleted', false)
      .single();

    if (userError || !user) {
      return null; // safe: no stack trace leaked
    }

    // 3. Reject deleted / inactive accounts
    if (user.status !== 'active') {
      return null;
    }

    // 4. Verify password against the authoritative store: public.users.password_hash
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    // 5. Check must_change_password flag via secure RPC (private.user_credentials)
    const { data: credentials, error: credentialsError } = await supabase
      .rpc('get_user_credential_metadata', { p_user_id: user.user_id });

    if (credentialsError) {
      console.error('Auth service: error fetching user credentials via RPC:', credentialsError.message);
    }

    const mustChangePassword = credentials?.must_change_password === true;

    // 6. If user must change password, return requires_password_change flag
    if (mustChangePassword) {
      // Log forced password reset initiation
      try {
        // Create a minimal req object for logging since we don't have the full request context
        const logReq = {
          user: {
            schoolId: user.school_id,
            userId: user.user_id,
            role: user.role
          }
        };
        await logActivity(
          logReq,
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

    // 7. Check password policy compliance for existing valid password
    //    If the password doesn't meet the current policy, force a change
    const policy = getSchoolPasswordPolicy(effectiveSchoolId);
    const validation = validatePassword(password, {
      email: user.email,
      firstName: user.full_name,
    }, policy);

    if (!validation.valid) {
      // Password is valid (hash matches) but doesn't comply with current policy
      // Force password change on next login
      // Mark user for password reset via secure RPC (private.user_credentials)
      const { error: setError } = await supabase
        .rpc('set_must_change_password', { 
          p_user_id: user.user_id, 
          p_must_change: true 
        });
      
      if (setError) {
        console.error('Auth service: error setting must_change_password via RPC:', setError.message);
      }

      // Log password policy violation
      try {
        // Create a minimal req object for logging since we don't have the full request context
        const logReq = {
          user: {
            schoolId: user.school_id,
            userId: user.user_id,
            role: user.role
          }
        };
        await logActivity(
          logReq,
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

    // 8. Return full user object needed by login handler
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