// =====================================================
// ENHANCED MIDDLEWARE FOR EDUCORE UPGRADE
// =====================================================

import { PermissionService } from '../services/academicServices.js';

// =====================================================
// PERMISSION MIDDLEWARE
// =====================================================

/**
 * Middleware to check specific permissions
 */
export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const hasPermission = await PermissionService.checkPermission(
        req.user?.user_id,
        permission,
        req.params.resourceId || req.body.resourceId
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: "Insufficient permissions",
          required: permission
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: "Permission check failed" });
    }
  };
}

/**
 * Middleware for term-specific actions
 */
export function requireTermAccess(action) {
  return async (req, res, next) => {
    const termId = req.params.termId || req.body.termId;

    if (!termId) return next();

    try {
      // Check if term is locked for certain actions
      if (action === 'modify') {
        const { data: term } = await req.supabase
          .from('terms')
          .select('status')
          .eq('term_id', termId)
          .single();

        if (term?.status === 'locked') {
          return res.status(403).json({
            message: "Term is locked and cannot be modified"
          });
        }
      }

      // Check user permission for term action
      const hasPermission = await PermissionService.checkPermission(
        req.user?.user_id,
        `term.${action}`,
        termId
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: "Cannot perform this action on term"
        });
      }

      next();
    } catch (error) {
      console.error('Term access check error:', error);
      res.status(500).json({ message: "Term access check failed" });
    }
  };
}

/**
 * Middleware for financial actions
 */
export function requireFinanceAccess(action) {
  return async (req, res, next) => {
    try {
      let permission = 'finance.view';

      switch (action) {
        case 'create_payment':
          permission = 'finance.create_payments';
          break;
        case 'adjust_balance':
          permission = 'finance.adjust_balances';
          break;
        case 'approve_adjustment':
          permission = 'finance.approve_adjustments';
          break;
        case 'view_ledger':
          permission = 'ledger.view';
          break;
      }

      const hasPermission = await PermissionService.checkPermission(
        req.user?.user_id,
        permission,
        req.params.studentId || req.body.studentId
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: "Insufficient financial permissions",
          required: permission
        });
      }

      next();
    } catch (error) {
      console.error('Finance access check error:', error);
      res.status(500).json({ message: "Finance access check failed" });
    }
  };
}

/**
 * Middleware for student management actions
 */
export function requireStudentAccess(action) {
  return async (req, res, next) => {
    try {
      let permission = 'students.view';

      switch (action) {
        case 'manage':
          permission = 'students.manage';
          break;
        case 'view_enrollment':
          permission = 'enrollment.view';
          break;
        case 'manage_enrollment':
          permission = 'enrollment.manage';
          break;
        case 'view_promotion':
          permission = 'promotion.view';
          break;
        case 'approve_promotion':
          permission = 'promotion.approve';
          break;
      }

      const hasPermission = await PermissionService.checkPermission(
        req.user?.user_id,
        permission,
        req.params.id || req.body.studentId
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: "Insufficient student permissions",
          required: permission
        });
      }

      next();
    } catch (error) {
      console.error('Student access check error:', error);
      res.status(500).json({ message: "Student access check failed" });
    }
  };
}

// =====================================================
// AUDIT LOGGING MIDDLEWARE
// =====================================================

/**
 * Middleware to automatically log API actions
 */
export function auditLog(action) {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
      // Log successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logApiAction(req, res, action, data).catch(err =>
          console.error('Audit logging failed:', err)
        );
      }
      originalSend.call(this, data);
    };
    next();
  };
}

/**
 * Log API action to audit trail
 */
async function logApiAction(req, res, action, responseData) {
  try {
    const auditEntry = {
      user_id: req.user?.user_id,
      action: action,
      resource_type: getResourceTypeFromUrl(req.url),
      resource_id: req.params?.id || req.body?.id,
      details: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        responseStatus: res.statusCode
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      timestamp: new Date()
    };

    // Insert audit log (assuming you have an audit_logs table)
    await req.supabase
      .from('audit_logs')
      .insert(auditEntry);

  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Audit logging error:', error);
  }
}

/**
 * Extract resource type from URL
 */
function getResourceTypeFromUrl(url) {
  const segments = url.split('/').filter(s => s);
  if (segments.length < 2) return 'unknown';

  const resourceMap = {
    'students': 'student',
    'fees': 'fee',
    'payments': 'payment',
    'invoices': 'invoice',
    'academic': 'academic',
    'finance': 'finance',
    'promotion': 'promotion'
  };

  return resourceMap[segments[1]] || segments[1] || 'unknown';
}

// =====================================================
// TENANT SECURITY MIDDLEWARE
// =====================================================

/**
 * Enhanced tenant context validation
 */
export function tenantSecurityCheck(req, res, next) {
  const schoolId = req.user?.schoolId || req.user?.school_id;
  const requestedSchoolId = req.params?.schoolId || req.body?.school_id;

  if (!schoolId) {
    return res.status(401).json({ message: "No school context" });
  }

  // If request specifies a school_id, ensure it matches user's school
  if (requestedSchoolId && requestedSchoolId !== schoolId.toString()) {
    return res.status(403).json({
      message: "Access denied: School context mismatch"
    });
  }

  // Add school context to request
  req.schoolContext = { schoolId };
  next();
}

/**
 * Validate resource ownership
 */
export function validateResourceOwnership(resourceType) {
  return async (req, res, next) => {
    const schoolId = req.user?.schoolId || req.user?.school_id;
    const resourceId = req.params?.id;

    if (!resourceId) return next();

    try {
      let query = req.supabase
        .from(resourceType)
        .select('school_id')
        .eq(`${resourceType.slice(0, -1)}_id`, resourceId) // Remove 's' and add '_id'
        .single();

      const { data, error } = await query;

      if (error || !data) {
        return res.status(404).json({ message: "Resource not found" });
      }

      if (data.school_id !== schoolId) {
        return res.status(403).json({ message: "Access denied: Resource not owned by school" });
      }

      next();
    } catch (error) {
      console.error('Resource ownership validation error:', error);
      res.status(500).json({ message: "Resource validation failed" });
    }
  };
}

// =====================================================
// RATE LIMITING ENHANCEMENTS
// =====================================================

/**
 * Enhanced rate limiting for sensitive operations
 */
export function enhancedRateLimit(windowMs, maxRequests, sensitive = false) {
  return (req, res, next) => {
    const key = `${req.user?.user_id || req.ip}:${req.url}`;
    const now = Date.now();

    // Get or create rate limit data
    if (!global.rateLimitData) global.rateLimitData = new Map();

    const userData = global.rateLimitData.get(key) || {
      requests: [],
      blocked: false
    };

    // Clean old requests
    userData.requests = userData.requests.filter(time => now - time < windowMs);

    // Check if blocked
    if (userData.blocked && sensitive) {
      return res.status(429).json({
        message: "Too many requests. Account temporarily blocked.",
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Check rate limit
    if (userData.requests.length >= maxRequests) {
      if (sensitive) {
        userData.blocked = true;
        // Log security event
        console.warn(`Rate limit exceeded for sensitive operation: ${key}`);
      }

      return res.status(429).json({
        message: "Too many requests",
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    userData.requests.push(now);
    global.rateLimitData.set(key, userData);

    next();
  };
}

// =====================================================
// DATA VALIDATION MIDDLEWARE
// =====================================================

/**
 * Validate business rules for term operations
 */
export function validateTermOperation(operation) {
  return async (req, res, next) => {
    try {
      const termId = req.params.termId || req.body.termId;

      switch (operation) {
        case 'close':
          const canClose = await validateTermClosure(termId);
          if (!canClose.valid) {
            return res.status(400).json({
              message: "Cannot close term",
              reasons: canClose.reasons
            });
          }
          break;

        case 'open':
          const canOpen = await validateTermOpening(termId);
          if (!canOpen.valid) {
            return res.status(400).json({
              message: "Cannot open term",
              reasons: canOpen.reasons
            });
          }
          break;
      }

      next();
    } catch (error) {
      console.error('Term validation error:', error);
      res.status(500).json({ message: "Term validation failed" });
    }
  };
}

/**
 * Validate term closure business rules
 */
async function validateTermClosure(termId) {
  const reasons = [];

  try {
    // Check if all invoices are generated
    const { data: invoices } = await supabase
      .from('invoices')
      .select('status')
      .eq('term_id', termId);

    if (!invoices?.length) {
      reasons.push('No invoices found for this term');
    }

    // Check for unpaid balances
    const unpaidCount = invoices?.filter(inv => inv.status !== 'paid').length || 0;
    if (unpaidCount > 0) {
      reasons.push(`${unpaidCount} invoices are not fully paid`);
    }

    return {
      valid: reasons.length === 0,
      reasons
    };
  } catch (error) {
    return {
      valid: false,
      reasons: ['Validation error occurred']
    };
  }
}

/**
 * Validate term opening business rules
 */
async function validateTermOpening(termId) {
  const reasons = [];

  try {
    // Check if previous term is closed
    const { data: term } = await supabase
      .from('terms')
      .select('status, term_order')
      .eq('term_id', termId)
      .single();

    if (term?.status !== 'upcoming') {
      reasons.push('Term is not in upcoming status');
    }

    // Check if previous term exists and is closed
    if (term?.term_order > 1) {
      const { data: prevTerm } = await supabase
        .from('terms')
        .select('status')
        .eq('academic_year_id', term.academic_year_id)
        .eq('term_order', term.term_order - 1)
        .single();

      if (prevTerm?.status !== 'completed') {
        reasons.push('Previous term must be completed first');
      }
    }

    return {
      valid: reasons.length === 0,
      reasons
    };
  } catch (error) {
    return {
      valid: false,
      reasons: ['Validation error occurred']
    };
  }
}