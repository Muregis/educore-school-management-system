/**
 * API Versioning Middleware
 * Supports multiple API versions for backward compatibility
 */

const API_VERSIONS = ['v1', 'v2'];
const DEFAULT_VERSION = 'v1';

/**
 * Extract API version from request
 */
export function extractApiVersion(req) {
  // Check header
  const headerVersion = req.headers['api-version'];
  if (headerVersion && API_VERSIONS.includes(headerVersion)) {
    return headerVersion;
  }
  
  // Check query parameter
  const queryVersion = req.query.version;
  if (queryVersion && API_VERSIONS.includes(queryVersion)) {
    return queryVersion;
  }
  
  // Check URL path
  const pathMatch = req.path.match(/^\/api\/(v\d+)/);
  if (pathMatch && API_VERSIONS.includes(pathMatch[1])) {
    return pathMatch[1];
  }
  
  return DEFAULT_VERSION;
}

/**
 * API versioning middleware
 */
export function apiVersioning(req, res, next) {
  req.apiVersion = extractApiVersion(req);
  res.setHeader('api-version', req.apiVersion);
  next();
}
