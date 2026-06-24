/**
 * Password Policy Middleware
 * Enforces enterprise password requirements
 */

const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true,
  maxAge: 90, // days
  historyCount: 5, // number of previous passwords to remember
  preventReuse: true
};

const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', 'master', 'dragon', '111111', 'baseball'
];

/**
 * Validate password against policy
 */
export function validatePassword(password, userInfo = {}) {
  const errors = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  if (PASSWORD_POLICY.preventCommonPasswords && COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  if (PASSWORD_POLICY.preventUserInfo) {
    const { email, firstName, lastName } = userInfo;
    const lowerPassword = password.toLowerCase();
    
    if (email && lowerPassword.includes(email.split('@')[0].toLowerCase())) {
      errors.push('Password must not contain email username');
    }
    
    if (firstName && lowerPassword.includes(firstName.toLowerCase())) {
      errors.push('Password must not contain first name');
    }
    
    if (lastName && lowerPassword.includes(lastName.toLowerCase())) {
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
