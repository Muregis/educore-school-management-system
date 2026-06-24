/**
 * Idempotency Middleware
 * Ensures safe retry of POST/PUT operations
 * Prevents duplicate processing of identical requests
 */

const idempotencyStore = new Map();

/**
 * Idempotency middleware
 * @param {Number} ttl - Time to live in seconds (default: 86400 = 24 hours)
 */
export function idempotency(ttl = 86400) {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    
    // Only apply to POST, PUT, PATCH
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }
    
    if (!idempotencyKey) {
      return next();
    }
    
    // Check if this key was already used
    const existing = idempotencyStore.get(idempotencyKey);
    
    if (existing) {
      // Return cached response
      return res.status(existing.status).json(existing.body);
    }
    
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    
    res.json = function(body) {
      // Cache the response
      idempotencyStore.set(idempotencyKey, {
        status: res.statusCode,
        body,
        timestamp: Date.now()
      });
      
      // Set expiration
      setTimeout(() => {
        idempotencyStore.delete(idempotencyKey);
      }, ttl * 1000);
      
      return originalJson(body);
    };
    
    next();
  };
}
