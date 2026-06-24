import { z } from 'zod';

/**
 * Validation Middleware
 * Provides centralized validation using Zod schemas
 * Extends existing validation patterns without breaking current endpoints
 */

/**
 * Validation error codes
 */
export const ValidationErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_TYPE: 'INVALID_TYPE',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  INVALID_ENUM: 'INVALID_ENUM'
};

/**
 * Create validation middleware from Zod schema
 * @param {ZodSchema} schema - Zod validation schema
 * @param {String} target - 'body' | 'query' | 'params' (default: 'body')
 */
export function validate(schema, target = 'body') {
  return (req, res, next) => {
    try {
      const data = req[target];
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        return res.error(
          ValidationErrorCodes.VALIDATION_ERROR,
          'Validation failed',
          { errors },
          400
        );
      }
      
      // Replace the target with validated data
      req[target] = result.data;
      next();
    } catch (error) {
      return res.error(
        ValidationErrorCodes.VALIDATION_ERROR,
        'Validation error occurred',
        { error: error.message },
        500
      );
    }
  };
}

/**
 * Validate request body
 */
export function validateBody(schema) {
  return validate(schema, 'body');
}

/**
 * Validate query parameters
 */
export function validateQuery(schema) {
  return validate(schema, 'query');
}

/**
 * Validate route parameters
 */
export function validateParams(schema) {
  return validate(schema, 'params');
}

/**
 * Common validation schemas
 * Reusable schemas for common patterns
 */
export const commonSchemas = {
  // ID validation
  id: z.string().uuid('Invalid ID format'),
  
  // Numeric ID validation (for legacy integer IDs)
  numericId: z.number().int().positive('Invalid numeric ID'),
  
  // Email validation
  email: z.string().email('Invalid email format'),
  
  // Phone validation (Kenyan format)
  phone: z.string().regex(/^(\+?254|0)[17][0-9]{8}$/, 'Invalid Kenyan phone number'),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('asc')
  }),
  
  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }),
  
  // Search query
  search: z.object({
    search: z.string().min(1).optional(),
    filters: z.record(z.any()).optional()
  })
};

/**
 * Student validation schemas
 */
export const studentSchemas = {
  create: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
    gender: z.enum(['male', 'female', 'other']),
    dateOfBirth: z.string().datetime(),
    admissionNumber: z.string().min(1),
    classId: z.string().uuid().optional(),
    streamId: z.string().uuid().optional(),
    guardianId: z.string().uuid().optional()
  }),
  
  update: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    dateOfBirth: z.string().datetime().optional(),
    classId: z.string().uuid().optional(),
    streamId: z.string().uuid().optional(),
    guardianId: z.string().uuid().optional()
  })
};

/**
 * Teacher validation schemas
 */
export const teacherSchemas = {
  create: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: commonSchemas.email,
    phone: commonSchemas.phone.optional(),
    gender: z.enum(['male', 'female', 'other']),
    dateOfBirth: z.string().datetime().optional(),
    staffNumber: z.string().min(1).optional(),
    subjectIds: z.array(z.string().uuid()).optional(),
    department: z.string().optional()
  }),
  
  update: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    dateOfBirth: z.string().datetime().optional(),
    staffNumber: z.string().min(1).optional(),
    subjectIds: z.array(z.string().uuid()).optional(),
    department: z.string().optional()
  })
};
