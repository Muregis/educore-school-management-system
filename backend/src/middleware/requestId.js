import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID Middleware
 * Adds unique request ID to each request for tracing and debugging
 * Extends existing middleware chain without breaking functionality
 */
export function requestId(req, res, next) {
  // Use existing request ID from header or generate new one
  req.id = req.headers['x-request-id'] || uuidv4();
  
  // Add request ID to response headers for client tracing
  res.setHeader('x-request-id', req.id);
  
  // Add correlation ID if provided by upstream services
  req.correlationId = req.headers['x-correlation-id'] || req.id;
  res.setHeader('x-correlation-id', req.correlationId);
  
  next();
}
