import crypto from 'crypto';

// Tenant-aware cache implementation for multi-tenant safety
export class TenantCacheManager {
  constructor(cacheStore, options = {}) {
    this.cacheStore = cacheStore;
    this.options = {
      keyPrefix: 'tenant:',
      separator: ':',
      defaultTTL: 3600, // 1 hour
      encryptionKey: options.encryptionKey,
      ...options
    };
  }

  // Generate tenant-scoped cache key
  generateKey(schoolId, key) {
    return `${this.options.keyPrefix}${schoolId}${this.options.separator}${key}`;
  }

  // Encrypt sensitive cache data
  encrypt(data) {
    if (!this.options.encryptionKey) return data;
    
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, this.options.encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Cache encryption failed:', error);
      return data;
    }
  }

  // Decrypt sensitive cache data
  decrypt(encryptedData) {
    if (!this.options.encryptionKey || !encryptedData.encrypted) {
      return encryptedData;
    }
    
    try {
      const algorithm = 'aes-256-gcm';
      const decipher = crypto.createDecipher(algorithm, this.options.encryptionKey);
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Cache decryption failed:', error);
      return null;
    }
  }

  // Set cache value with tenant isolation
  async set(schoolId, key, value, ttl = this.options.defaultTTL) {
    const tenantKey = this.generateKey(schoolId, key);
    const encryptedValue = this.encrypt(value);
    
    try {
      await this.cacheStore.set(tenantKey, encryptedValue, ttl);
      return true;
    } catch (error) {
      console.error('Cache set failed:', error);
      return false;
    }
  }

  // Get cache value with tenant isolation
  async get(schoolId, key) {
    const tenantKey = this.generateKey(schoolId, key);
    
    try {
      const value = await this.cacheStore.get(tenantKey);
      return this.decrypt(value);
    } catch (error) {
      console.error('Cache get failed:', error);
      return null;
    }
  }

  // Delete cache value for specific tenant
  async del(schoolId, key) {
    const tenantKey = this.generateKey(schoolId, key);
    
    try {
      await this.cacheStore.del(tenantKey);
      return true;
    } catch (error) {
      console.error('Cache delete failed:', error);
      return false;
    }
  }

  // Clear all cache for specific tenant
  async clearTenant(schoolId) {
    const pattern = `${this.options.keyPrefix}${schoolId}${this.options.separator}*`;
    
    try {
      await this.cacheStore.clear(pattern);
      return true;
    } catch (error) {
      console.error('Tenant cache clear failed:', error);
      return false;
    }
  }

  // Check if cache exists for tenant
  async exists(schoolId, key) {
    const tenantKey = this.generateKey(schoolId, key);
    
    try {
      return await this.cacheStore.exists(tenantKey);
    } catch (error) {
      console.error('Cache exists check failed:', error);
      return false;
    }
  }
}

// In-memory cache implementation for development/testing
export class MemoryCacheStore {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  set(key, value, ttl) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set value
    this.cache.set(key, value);

    // Set expiration timer
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);
      this.timers.set(key, timer);
    }
  }

  get(key) {
    return this.cache.get(key) || null;
  }

  del(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  clear(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.del(key);
      }
    }
  }

  exists(key) {
    return this.cache.has(key);
  }
}

// Client-side cache isolation for React
export function useTenantCache(schoolId, options = {}) {
  const cachePrefix = `tenant_${schoolId}_`;
  
  return {
    set: (key, value) => {
      try {
        const tenantKey = cachePrefix + key;
        localStorage.setItem(tenantKey, JSON.stringify(value));
      } catch (error) {
        console.warn('Client cache set failed:', error);
      }
    },
    
    get: (key) => {
      try {
        const tenantKey = cachePrefix + key;
        const value = localStorage.getItem(tenantKey);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.warn('Client cache get failed:', error);
        return null;
      }
    },
    
    del: (key) => {
      try {
        const tenantKey = cachePrefix + key;
        localStorage.removeItem(tenantKey);
      } catch (error) {
        console.warn('Client cache delete failed:', error);
      }
    },
    
    clear: () => {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(cachePrefix)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('Client cache clear failed:', error);
      }
    }
  };
}

// Cache invalidation middleware
export function createCacheInvalidationMiddleware(cacheManager) {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Invalidate cache on data modifications
      if (req.method !== 'GET' && req.user?.schoolId) {
        const schoolId = req.user.schoolId;
        
        // Invalidate tenant-specific caches
        setTimeout(async () => {
          try {
            // Clear relevant cache entries based on the route
            const cacheKey = generateCacheKeyFromRoute(req.path);
            await cacheManager.del(schoolId, cacheKey);
            
            // Clear related cache entries
            await invalidateRelatedCaches(cacheManager, schoolId, req.path);
          } catch (error) {
            console.error('Cache invalidation failed:', error);
          }
        }, 0);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Helper functions
function generateCacheKeyFromRoute(path) {
  return path.replace(/[^a-zA-Z0-9]/g, '_');
}

async function invalidateRelatedCaches(cacheManager, schoolId, path) {
  // Define cache invalidation rules
  const invalidationRules = {
    '/api/students': ['students_list', 'student_details'],
    '/api/payments': ['payments_list', 'payment_stats'],
    '/api/users': ['users_list', 'user_details'],
    '/api/classes': ['classes_list', 'class_details']
  };
  
  for (const [route, keys] of Object.entries(invalidationRules)) {
    if (path.startsWith(route)) {
      for (const key of keys) {
        await cacheManager.del(schoolId, key);
      }
    }
  }
}

export default {
  TenantCacheManager,
  MemoryCacheStore,
  useTenantCache,
  createCacheInvalidationMiddleware
};
