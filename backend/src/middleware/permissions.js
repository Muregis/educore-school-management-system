/**
 * Permissions Middleware
 * Handles role-based access control for API endpoints
 */

import jwt from 'jsonwebtoken';
import { promisify } from 'util';

// Role permissions mapping
const ROLE_PERMISSIONS = {
  director: [
    'dashboard', 'upgrade', 'students', 'staff', 'attendance', 'grades', 'subjects', 'fees',
    'mpesa-reconcile', 'admissions', 'invoices', 'reportcards', 'discipline', 'transport',
    'communication', 'messaging', 'timetable', 'reports', 'analytics', 'accounts', 'hr',
    'library', 'lessonplans', 'pendingplans', 'settings', 'announcements', 'bulk-import',
    'exams', 'medical', 'update-requests', 'academic.view', 'academic.manage',
    'promotion.view', 'promotion.approve', 'branch-management', 'admin-permissions'
  ],
  superadmin: [
    'dashboard', 'upgrade', 'students', 'staff', 'attendance', 'grades', 'subjects', 'fees',
    'mpesa-reconcile', 'admissions', 'invoices', 'reportcards', 'discipline', 'transport',
    'communication', 'messaging', 'timetable', 'reports', 'analytics', 'accounts', 'hr',
    'library', 'lessonplans', 'pendingplans', 'settings', 'announcements', 'bulk-import',
    'exams', 'medical', 'update-requests', 'academic.view', 'academic.manage',
    'promotion.view', 'promotion.approve', 'branch-management'
  ],
  admin: [
    'dashboard', 'students', 'attendance', 'communication', 'announcements',
    'academic.view', 'academic.manage', 'promotion.view', 'promotion.approve'
  ],
  teacher: [
    'dashboard', 'attendance', 'grades', 'reportcards', 'discipline', 'timetable',
    'communication', 'messaging', 'library', 'analysis', 'lessonplans', 'announcements', 'exams',
    'academic.view', 'students.view'
  ],
  finance: [
    'dashboard', 'fees', 'mpesa-reconcile', 'invoices', 'announcements', 'upgrade'
  ],
  hr: [
    'dashboard', 'hr', 'staff', 'announcements', 'upgrade'
  ],
  librarian: [
    'dashboard', 'library', 'announcements'
  ],
  parent: [
    'dashboard', 'grades', 'fees', 'reportcards', 'attendance', 'communication',
    'announcements', 'update-requests', 'students.view', 'academic.view'
  ],
  student: [
    'dashboard', 'grades', 'attendance', 'reportcards', 'library', 'announcements', 'academic.view'
  ]
};

/**
 * Verify JWT token and extract user info
 */
const verifyToken = async (token) => {
  if (!token) {
    throw new Error('No token provided');
  }
  
  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * Check if user has permission to access a resource
 */
const hasPermission = (userRole, permission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};

/**
 * Authentication middleware
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = await verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Authorization middleware - check specific permission
 */
const authorize = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * Role-based authorization middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * Owner or admin authorization - user can access their own resources or admin can access any
 */
const ownerOrAdmin = (userIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }
    
    // User can only access their own resources
    const resourceUserId = req.params[userIdField] || req.body[userIdField];
    
    if (req.user.userId !== resourceUserId && req.user.id !== resourceUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    next();
  };
};

/**
 * Parent-specific authorization - parent can only access their children's data
 */
const parentOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'parent') {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  next();
};

/**
 * Student-specific authorization - student can only access their own data
 */
const studentOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  next();
};

/**
 * Check if user can edit data
 */
const canEdit = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const editableRoles = ['director', 'superadmin', 'admin', 'teacher', 'hr', 'finance'];

  if (!editableRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Read-only access' });
  }

  next();
};

/**
 * Middleware to check if user can access student data
 * Parents can only access their children, others based on role
 */
const canAccessStudentData = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Admin can access all student data
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Teachers can access their class students
  if (req.user.role === 'teacher') {
    // This would need to be implemented based on teacher-class assignments
    return next();
  }
  
  // Parents can only access their children's data
  if (req.user.role === 'parent') {
    // This would need to be implemented based on parent-child relationships
    return next();
  }
  
  // Students can only access their own data
  if (req.user.role === 'student') {
    const studentId = req.params.studentId || req.params.id;
    if (req.user.studentId !== studentId && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    return next();
  }
  
  return res.status(403).json({ message: 'Access denied' });
};

export {
  authenticate,
  authorize,
  requireRole,
  ownerOrAdmin,
  parentOnly,
  studentOnly,
  canEdit,
  canAccessStudentData,
  hasPermission,
  ROLE_PERMISSIONS
};
