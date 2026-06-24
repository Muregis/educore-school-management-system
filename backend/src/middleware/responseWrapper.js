/**
 * Response Wrapper Middleware
 * Standardizes all API responses with consistent structure
 * Extends existing response patterns without breaking current endpoints
 */

/**
 * Success response wrapper
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {Object} meta - Optional metadata
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
export function successResponse(res, data = null, meta = {}, statusCode = 200) {
  const response = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.req?.id || null,
      correlationId: res.req?.correlationId || null,
      ...meta
    }
  };
  
  return res.status(statusCode).json(response);
}

/**
 * Error response wrapper
 * @param {Object} res - Express response object
 * @param {String} code - Error code
 * @param {String} message - Human-readable error message
 * @param {Object} details - Additional error details
 * @param {Number} statusCode - HTTP status code (default: 500)
 */
export function errorResponse(res, code, message, details = {}, statusCode = 500) {
  const response = {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId: res.req?.id || null,
      correlationId: res.req?.correlationId || null
    }
  };
  
  return res.status(statusCode).json(response);
}

/**
 * Paginated response wrapper
 * @param {Object} res - Express response object
 * @param {Array} data - Response data array
 * @param {Object} pagination - Pagination metadata
 * @param {Object} meta - Additional metadata
 */
export function paginatedResponse(res, data = [], pagination = {}, meta = {}) {
  const response = {
    success: true,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      total: pagination.total || 0,
      totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 20)),
      ...pagination
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.req?.id || null,
      correlationId: res.req?.correlationId || null,
      ...meta
    }
  };
  
  return res.status(200).json(response);
}

/**
 * Middleware to attach response helpers to res object
 * This allows existing routes to gradually adopt the new pattern
 */
export function responseWrapper(req, res, next) {
  res.success = (data, meta, statusCode) => successResponse(res, data, meta, statusCode);
  res.error = (code, message, details, statusCode) => errorResponse(res, code, message, details, statusCode);
  res.paginated = (data, pagination, meta) => paginatedResponse(res, data, pagination, meta);
  next();
}
