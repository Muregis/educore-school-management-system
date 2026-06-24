import { cache } from '../utils/cache.js';

/**
 * Cache middleware
 * Caches GET requests for improved performance
 */
export function cacheMiddleware(ttl = 300) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if user not authenticated
    if (!req.user || !req.user.schoolId) {
      return next();
    }

    const cacheKey = `${req.user.schoolId}:${req.originalUrl}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Store original res.json
    const originalJson = res.json.bind(res);

    res.json = function(body) {
      cache.set(cacheKey, body, ttl);
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache middleware
 */
export function invalidateCache(pattern) {
  return (req, res, next) => {
    // Invalidate cache after mutation operations
    res.on('finish', () => {
      if (res.statusCode < 400) {
        // Simple pattern-based invalidation
        // In production with Redis, use pattern matching
        cache.clear();
      }
    });
    next();
  };
}
