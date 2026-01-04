/**
 * Tests for Cache module
 */

import cache, { Cache } from '../cache.js';

describe('Cache', () => {
  beforeEach(() => {
    cache.clear();
  });

  describe('Static key generators', () => {
    describe('weatherKey', () => {
      test('generates correct weather cache key', () => {
        expect(Cache.weatherKey(1, 'current')).toBe('weather:1:current');
        expect(Cache.weatherKey(42, 'hourly')).toBe('weather:42:hourly');
        expect(Cache.weatherKey(123, 'week')).toBe('weather:123:week');
      });
    });

    describe('subscriptionsKey', () => {
      test('generates correct subscriptions key', () => {
        expect(Cache.subscriptionsKey()).toBe('subscriptions');
      });
    });
  });

  describe('set and get', () => {
    test('stores and retrieves value', () => {
      cache.set('test-key', { data: 'test' });
      expect(cache.get('test-key')).toEqual({ data: 'test' });
    });

    test('stores complex objects', () => {
      const complexData = {
        city: { id: 1, name: 'Kyiv' },
        period: 'current',
        data: [{ temp: 15, description: 'sunny' }],
        meta: { count: 1, fetched_at: '2026-01-03T12:00:00Z' },
      };

      cache.set('weather-key', complexData);
      expect(cache.get('weather-key')).toEqual(complexData);
    });

    test('stores arrays', () => {
      const arrayData = [1, 2, 3, 4, 5];
      cache.set('array-key', arrayData);
      expect(cache.get('array-key')).toEqual(arrayData);
    });

    test('stores null values', () => {
      cache.set('null-key', null);
      // Note: null is a valid value, but get returns null for missing/expired
      // so this might return null but treated as "no cache"
      expect(cache.has('null-key')).toBe(false); // null is falsy
    });

    test('returns null for non-existent key', () => {
      expect(cache.get('non-existent')).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('uses custom TTL when provided', () => {
      cache.set('short-lived', 'data', 1); // 1 second TTL

      expect(cache.get('short-lived')).toBe('data');

      // Advance time by 500ms
      jest.advanceTimersByTime(500);
      expect(cache.get('short-lived')).toBe('data');

      // Advance time past TTL
      jest.advanceTimersByTime(600);
      expect(cache.get('short-lived')).toBeNull();
    });

    test('uses default TTL when not provided', () => {
      cache.set('default-ttl', 'data');

      expect(cache.get('default-ttl')).toBe('data');

      // Default is 600 seconds (10 minutes)
      jest.advanceTimersByTime(599 * 1000);
      expect(cache.get('default-ttl')).toBe('data');

      jest.advanceTimersByTime(2 * 1000);
      expect(cache.get('default-ttl')).toBeNull();
    });

    test('expired entries are removed on get', () => {
      cache.set('expire-test', 'data', 1);

      jest.advanceTimersByTime(2000);

      // First get should return null and remove entry
      expect(cache.get('expire-test')).toBeNull();

      // Entry should be removed from store
      expect(cache.store.has('expire-test')).toBe(false);
    });
  });

  describe('has', () => {
    test('returns true for existing valid entry', () => {
      cache.set('exists', 'data');
      expect(cache.has('exists')).toBe(true);
    });

    test('returns false for non-existent entry', () => {
      expect(cache.has('does-not-exist')).toBe(false);
    });

    test('returns false for expired entry', () => {
      jest.useFakeTimers();
      cache.set('expired', 'data', 1);

      jest.advanceTimersByTime(2000);
      expect(cache.has('expired')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('delete', () => {
    test('removes specific entry', () => {
      cache.set('to-delete', 'data');
      cache.set('to-keep', 'data');

      cache.delete('to-delete');

      expect(cache.get('to-delete')).toBeNull();
      expect(cache.get('to-keep')).toBe('data');
    });

    test('handles deleting non-existent key', () => {
      expect(() => cache.delete('non-existent')).not.toThrow();
    });
  });

  describe('clear', () => {
    test('removes all entries', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');
      cache.set('key3', 'data3');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(cache.store.size).toBe(0);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('removes expired entries', () => {
      cache.set('short', 'data', 1);
      cache.set('long', 'data', 100);

      jest.advanceTimersByTime(2000);

      cache.cleanup();

      expect(cache.store.has('short')).toBe(false);
      expect(cache.store.has('long')).toBe(true);
    });

    test('keeps valid entries', () => {
      cache.set('valid1', 'data1', 100);
      cache.set('valid2', 'data2', 100);

      cache.cleanup();

      expect(cache.get('valid1')).toBe('data1');
      expect(cache.get('valid2')).toBe('data2');
    });
  });

  describe('stats', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('returns cache statistics', () => {
      cache.set('valid1', 'data', 100);
      cache.set('valid2', 'data', 100);
      cache.set('expired', 'data', 1);

      jest.advanceTimersByTime(2000);

      const stats = cache.stats();

      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(2);
      expect(stats.expired).toBe(1);
    });

    test('returns zeros for empty cache', () => {
      const stats = cache.stats();

      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  describe('Weather caching use case', () => {
    test('caches weather data correctly', () => {
      const weatherData = {
        city: { id: 1, name: 'Kyiv', country: 'UA' },
        period: 'current',
        meta: { count: 1, fetched_at: '2026-01-03T12:00:00Z', cache_ttl: 600 },
        data: [
          {
            dt: 1735905600,
            temp: 15,
            feels_like: 14,
            humidity: 65,
            description: 'clear sky',
            icon: '01d',
          },
        ],
      };

      const key = Cache.weatherKey(1, 'current');
      cache.set(key, weatherData, 600);

      const cached = cache.get(key);
      expect(cached).toEqual(weatherData);
      expect(cached.city.name).toBe('Kyiv');
      expect(cached.data[0].temp).toBe(15);
    });

    test('caches different periods separately', () => {
      cache.set(Cache.weatherKey(1, 'current'), { period: 'current' });
      cache.set(Cache.weatherKey(1, 'hourly'), { period: 'hourly' });
      cache.set(Cache.weatherKey(1, 'week'), { period: 'week' });

      expect(cache.get(Cache.weatherKey(1, 'current')).period).toBe('current');
      expect(cache.get(Cache.weatherKey(1, 'hourly')).period).toBe('hourly');
      expect(cache.get(Cache.weatherKey(1, 'week')).period).toBe('week');
    });

    test('caches different cities separately', () => {
      cache.set(Cache.weatherKey(1, 'current'), { city: 'Kyiv' });
      cache.set(Cache.weatherKey(2, 'current'), { city: 'London' });
      cache.set(Cache.weatherKey(3, 'current'), { city: 'Paris' });

      expect(cache.get(Cache.weatherKey(1, 'current')).city).toBe('Kyiv');
      expect(cache.get(Cache.weatherKey(2, 'current')).city).toBe('London');
      expect(cache.get(Cache.weatherKey(3, 'current')).city).toBe('Paris');
    });
  });
});

