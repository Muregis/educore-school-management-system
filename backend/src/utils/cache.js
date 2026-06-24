/**
 * Simple in-memory cache
 * Placeholder for Redis implementation
 */

class Cache {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
  }

  set(key, value, ttl = 3600) {
    this.cache.set(key, value);
    this.ttls.set(key, Date.now() + (ttl * 1000));
  }

  get(key) {
    const expiry = this.ttls.get(key);
    if (expiry && Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  delete(key) {
    this.cache.delete(key);
    this.ttls.delete(key);
  }

  clear() {
    this.cache.clear();
    this.ttls.clear();
  }
}

export const cache = new Cache();
