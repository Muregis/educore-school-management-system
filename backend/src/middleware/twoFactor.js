import speakeasy from 'speakeasy';

/**
 * Two-Factor Authentication Middleware
 * Implements TOTP-based 2FA
 */

/**
 * Generate 2FA secret
 */
export function generateTwoFactorSecret() {
  return speakeasy.generateSecret({
    name: 'EduCore ERP',
    issuer: 'EduCore'
  });
}

/**
 * Generate 2FA backup codes
 */
export function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(speakeasy.generateSecret({ length: 10 }).base32);
  }
  return codes;
}

/**
 * Verify 2FA token
 */
export function verifyTwoFactorToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token
  });
}

/**
 * 2FA middleware
 */
export function requireTwoFactor(req, res, next) {
  const user = req.user;
  
  if (!user.two_factor_enabled) {
    return next(); // 2FA not enabled, skip
  }
  
  const twoFactorToken = req.headers['x-2fa-token'];
  
  if (!twoFactorToken) {
    return res.error('2FA_REQUIRED', 'Two-factor authentication token required', {}, 401);
  }
  
  if (!verifyTwoFactorToken(user.two_factor_secret, twoFactorToken)) {
    return res.error('2FA_INVALID', 'Invalid two-factor authentication token', {}, 401);
  }
  
  next();
}
