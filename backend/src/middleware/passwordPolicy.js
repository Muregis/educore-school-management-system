/**
 * Password Policy Middleware
 * Enforces enterprise password requirements
 */

export const DEFAULT_PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: false,
  preventCommonPasswords: true,
  preventUserInfo: true,
  preventReuse: 5,
  expiryDays: 0,
};

const COMMON_PASSWORDS = [
  'password', 'password1', 'password123', 'passw0rd', '123456', '1234567',
  '12345678', '123456789', 'qwerty', 'qwerty123', 'abc123', 'monkey',
  'master', 'dragon', '111111', 'baseball', 'letmein', 'welcome',
  'welcome1', 'admin', 'admin123', 'director', 'school', 'school123',
  'changeme', 'default', 'iloveyou', 'sunshine', 'football', 'superadmin123',
];

/**
 * Build an effective policy from a school's `security_settings.passwordPolicy`.
 * Unknown or missing keys fall back to the platform defaults.
 */
export function resolvePasswordPolicy(schoolPolicy = null) {
  if (!schoolPolicy || typeof schoolPolicy !== 'object') return { ...DEFAULT_PASSWORD_POLICY };

  const numeric = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const boolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

  return {
    ...DEFAULT_PASSWORD_POLICY,
    minLength: Math.max(numeric(schoolPolicy.minLength, DEFAULT_PASSWORD_POLICY.minLength), DEFAULT_PASSWORD_POLICY.minLength),
    requireUppercase: boolean(schoolPolicy.requireUppercase, DEFAULT_PASSWORD_POLICY.requireUppercase),
    requireLowercase: boolean(schoolPolicy.requireLowercase, DEFAULT_PASSWORD_POLICY.requireLowercase),
    requireNumber: boolean(schoolPolicy.requireNumber, DEFAULT_PASSWORD_POLICY.requireNumber),
    requireSymbol: boolean(schoolPolicy.requireSymbol, DEFAULT_PASSWORD_POLICY.requireSymbol),
    preventReuse: numeric(schoolPolicy.preventReuse, DEFAULT_PASSWORD_POLICY.preventReuse),
    expiryDays: numeric(schoolPolicy.expiryDays, DEFAULT_PASSWORD_POLICY.expiryDays),
  };
}

/**
 * Validate password against policy
 */
export function validatePassword(password, userInfo = {}, policy = DEFAULT_PASSWORD_POLICY) {
  const errors = [];
  const value = String(password || '');
  const effective = { ...DEFAULT_PASSWORD_POLICY, ...policy };

  if (value.length < effective.minLength) {
    errors.push(`Password must be at least ${effective.minLength} characters`);
  }

  if (effective.requireUppercase && !/[A-Z]/.test(value)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (effective.requireLowercase && !/[a-z]/.test(value)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (effective.requireNumber && !/\d/.test(value)) {
    errors.push('Password must contain at least one number');
  }

  if (effective.requireSymbol && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
    errors.push('Password must contain at least one special character');
  }

  if (effective.preventCommonPasswords && COMMON_PASSWORDS.includes(value.toLowerCase())) {
    errors.push('Password is too common');
  }

  if (effective.preventUserInfo) {
    const { email, firstName, lastName } = userInfo || {};
    const lowerPassword = value.toLowerCase();

    if (email && lowerPassword.includes(String(email).split('@')[0].toLowerCase())) {
      errors.push('Password must not contain email username');
    }

    if (firstName && lowerPassword.includes(String(firstName).toLowerCase())) {
      errors.push('Password must not contain first name');
    }

    if (lastName && lowerPassword.includes(String(lastName).toLowerCase())) {
      errors.push('Password must not contain last name');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Password policy middleware
 */
export function enforcePasswordPolicy(req, res, next) {
  const { password } = req.body;
  
  if (!password) {
    return res.error('PASSWORD_REQUIRED', 'Password is required', {}, 400);
  }

  const validation = validatePassword(password, req.user);
  
  if (!validation.valid) {
    return res.error('PASSWORD_INVALID', 'Password does not meet security requirements', { errors: validation.errors }, 400);
  }

  next();
}
