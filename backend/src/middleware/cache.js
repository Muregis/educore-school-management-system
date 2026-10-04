import { cache } from '../utils/cache.js';

/**
 * Paths that must never be served from the response cache (high churn / money / ops).
 */
const NEVER_CACHE_PREFIXES = [
  '/api/health',
  '/api/auth',
  '/api/students',
  '/api/teachers',
  '/api/attendance',
  '/api/grades',
  '/api/payments',
  '/api/expenditures',
  '/api/hr',
  '/api/finance',
  '/api/reports',
  '/api/invoices',
  '/api/billing',
  '/api/discounts',
  '/api/notifications',
  '/api/communication',
  '/api/settings',
  '/api/classes',
  '/api/branches',
  '/api/admin',
  '/api/activity-logs',
  '/api/audit',
  '/api/backup',
  '/api/mpesa',
  '/api/paystack',
  '/api/parent',
  '/api/admissions',
  '/api/analytics',
  '/api/library',
  '/api/exams',
  '/api/exam-types',
  '/api/timetable',
  '/api/discipline',
  '/api/transport',
  '/api/medical',
  '/api/promotion',
  '/api/academic',
  '/api/upload',
  '/api/security',
];

function shouldSkipCache(url) {
  const path = String(url || '').split('?')[0];
  return NEVER_CACHE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + '/')
  );
}

function schoolPrefix(req) {
  const id = req.user?.schoolId ?? req.headers['x-school-id'] ?? req.headers['x-active-school-id'];
  return id != null ? `${id}:` : null;
}

/**
 * Cache GET responses briefly. Default TTL 30s (was 300s).
 * High-churn routes are skipped entirely.
 */
export function cacheMiddleware(ttl = 30) {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    if (shouldSkipCache(req.originalUrl)) {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    if (!req.user || !req.user.schoolId) {
      return next();
    }

    const cacheKey = `${req.user.schoolId}:${req.originalUrl}`;
    const cached = cache.get(cacheKey);

    if (cached != null) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      return res.json(cached);
    }

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, body, ttl);
      }
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      return originalJson(body);
    };

    next();
  };
}

/**
 * After a successful mutation, drop that school's cached GETs (or all if unknown).
 */
export function invalidateCacheOnMutation(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const prefix = schoolPrefix(req);
    if (prefix) {
      cache.deleteByPrefix(prefix);
    } else {
      cache.clear();
    }
  });

  next();
}

/**
 * Route-level invalidation middleware.
 */
export function invalidateCache(_pattern) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const prefix = schoolPrefix(req);
      if (prefix) cache.deleteByPrefix(prefix);
      else cache.clear();
    });
    next();
  };
}
