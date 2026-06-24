import compression from 'compression';

/**
 * Compression Middleware
 * Enables gzip compression for all responses
 * Reduces bandwidth usage and improves performance
 */

export const compressionMiddleware = compression({
  filter: (req, res) => {
    // Don't compress if the client doesn't accept gzip
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use default compression filter
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (1-9, 6 is default)
  chunkSize: 16 * 1024 // 16KB chunks
});
