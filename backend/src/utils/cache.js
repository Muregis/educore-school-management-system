/**
 * In-memory response cache with TTL and school-scoped invalidation.
 * Suitable for single-instance Node. Prefer Redis in multi-instance production.
 */

class Cache {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
  }

  set(key, value, ttlSeconds = 60) {
    this.cache.set(key, value);
    this.ttls.set(key, Date.now() + ttlSeconds * 1000);
  }

  get(key) {
    const expiry = this.ttls.get(key);
    if (expiry && Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    return this.cache.has(key) ? this.cache.get(key) : null;
  }

  delete(key) {
    this.cache.delete(key);
    this.ttls.delete(key);
  }

  /** Delete every key that starts with prefix (e.g. "schoolId:") */
  deleteByPrefix(prefix) {
    const p = String(prefix);
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(p)) this.delete(key);
    }
  }

  clear() {
    this.cache.clear();
    this.ttls.clear();
  }

  size() {
    return this.cache.size;
  }
}

export const cache = new Cache();
