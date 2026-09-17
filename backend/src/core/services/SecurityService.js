import bcrypt from 'bcryptjs';
import { BaseRepository } from '../BaseRepository.js';
import { generateTwoFactorSecret, generateBackupCodes, verifyTwoFactorToken } from '../../middleware/twoFactor.js';
import { validatePassword } from '../../middleware/passwordPolicy.js';
import { getSchoolPasswordPolicy } from '../../helpers/password-policy.helper.js';

/**
 * Security Service
 * Implements enterprise security features
 */
export class SecurityService {
  constructor() {
    this.usersRepository = new BaseRepository('users');
    this.userSessionsRepository = new BaseRepository('user_sessions');
    this.securityLogsRepository = new BaseRepository('security_logs');
  }

  /**
   * Enable 2FA for user
   */
  async enableTwoFactor(userId, context = {}) {
    const secret = generateTwoFactorSecret();
    const backupCodes = generateBackupCodes();

    await this.usersRepository.update(userId, {
      two_factor_enabled: true,
      two_factor_secret: secret.base32,
      two_factor_backup_codes: backupCodes
    }, context);

    await this.logSecurityEvent(userId, context.schoolId, '2fa_enabled', 'Two-factor authentication enabled');

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url,
      backupCodes
    };
  }

  /**
   * Disable 2FA for user
   */
  async disableTwoFactor(userId, context = {}) {
    await this.usersRepository.update(userId, {
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: null
    }, context);

    await this.logSecurityEvent(userId, context.schoolId, '2fa_disabled', 'Two-factor authentication disabled');

    return { success: true };
  }

  /**
   * Verify 2FA token
   */
  async verifyTwoFactor(userId, token) {
    const user = await this.usersRepository.findById(userId);
    if (!user || !user.two_factor_enabled) {
      throw new Error('Two-factor authentication not enabled');
    }

    const isValid = verifyTwoFactorToken(user.two_factor_secret, token);
    
    if (!isValid) {
      await this.logSecurityEvent(userId, user.school_id, '2fa_failed', 'Two-factor authentication failed', 'warning');
      throw new Error('Invalid two-factor token');
    }

    return { valid: true };
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword, context = {}) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentMatches = user.password_hash
      ? await bcrypt.compare(currentPassword, user.password_hash)
      : false;
    if (!currentMatches) {
      await this.logSecurityEvent(userId, user.school_id, 'password_change_failed', 'Current password mismatch', 'warning');
      throw new Error('Current password is incorrect');
    }

    const policy = await getSchoolPasswordPolicy(user.school_id);
    const validation = validatePassword(newPassword, { email: user.email, firstName: user.full_name }, policy);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const history = Array.isArray(user.password_history) ? user.password_history : [];
    const reused = await Promise.all(
      [user.password_hash, ...history].filter(Boolean).map(hash => bcrypt.compare(newPassword, hash))
    );
    if (reused.some(Boolean)) {
      throw new Error('Cannot reuse a recent password');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.usersRepository.update(userId, {
      password_hash: newHash,
      password_changed_at: new Date().toISOString(),
      password_history: [...history, user.password_hash].filter(Boolean).slice(-Math.max(policy.preventReuse, 1))
    }, context);

    await this.logSecurityEvent(userId, user.school_id, 'password_changed', 'Password changed successfully');

    return { success: true };
  }

  /**
   * Lock user account
   */
  async lockUserAccount(userId, reason, context = {}) {
    const lockedUntil = new Date();
    lockedUntil.setHours(lockedUntil.getHours() + 1); // Lock for 1 hour

    await this.usersRepository.update(userId, {
      failed_login_attempts: 0,
      locked_until: lockedUntil.toISOString()
    }, context);

    await this.logSecurityEvent(userId, context.schoolId, 'account_locked', reason, 'warning');

    return { locked_until: lockedUntil.toISOString() };
  }

  /**
   * Unlock user account
   */
  async unlockUserAccount(userId, context = {}) {
    await this.usersRepository.update(userId, {
      failed_login_attempts: 0,
      locked_until: null
    }, context);

    await this.logSecurityEvent(userId, context.schoolId, 'account_unlocked', 'Account unlocked');

    return { success: true };
  }

  /**
   * Log security event
   */
  async logSecurityEvent(userId, schoolId, eventType, details = {}, severity = 'info') {
    await this.securityLogsRepository.create({
      school_id: schoolId,
      user_id: userId,
      event_type: eventType,
      details,
      severity
    });
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId) {
    return await this.userSessionsRepository.findAll({
      user_id: userId,
      is_active: true
    });
  }

  /**
   * Revoke user session
   */
  async revokeSession(sessionId, context = {}) {
    await this.userSessionsRepository.update(sessionId, {
      is_active: false
    }, context);

    return { success: true };
  }

  /**
   * Revoke all user sessions except current
   */
  async revokeAllOtherSessions(userId, currentSessionId, context = {}) {
    const sessions = await this.userSessionsRepository.findAll({
      user_id: userId,
      is_active: true
    });

    for (const session of sessions.data) {
      if (session.id !== currentSessionId) {
        await this.revokeSession(session.id, context);
      }
    }

    return { revoked: sessions.data.length - 1 };
  }
}
