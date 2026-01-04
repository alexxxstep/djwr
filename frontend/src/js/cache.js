/**
 * Simple in-memory cache with TTL support
 * Used for caching API responses to reduce requests
 */

class Cache {
  constructor() {
    this.store = new Map();
    this.defaultTTL = 600; // 10 minutes default
  }

  /**
   * Generate cache key for weather data
   * @param {number} cityId - City ID
   * @param {string} period - Forecast period
   * @returns {string} Cache key
   */
  static weatherKey(cityId, period) {
    return `weather:${cityId}:${period}`;
  }

  /**
   * Generate cache key for subscriptions
   * @returns {string} Cache key
   */
  static subscriptionsKey() {
    return 'subscriptions';
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if expired/not found
   */
  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   */
  set(key, value, ttl = null) {
    const ttlMs = (ttl || this.defaultTTL) * 1000;

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if exists and valid
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete specific key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.store.clear();
  }

  /**
   * Clear expired entries (garbage collection)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Stats object
   */
  stats() {
    let valid = 0;
    let expired = 0;
    const now = Date.now();

    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.store.size,
      valid,
      expired,
    };
  }
}

// Singleton instance
const cache = new Cache();

// Run cleanup every 5 minutes
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000);

export default cache;
export { Cache };

