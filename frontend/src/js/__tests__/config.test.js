/**
 * Tests for Config module
 */

import {
  VALID_PERIODS,
  DEFAULT_PERIOD,
  CACHE_TTL,
  API_ENDPOINTS,
  PERIOD_LABELS,
  NOTIFICATION_PERIODS,
  NOTIFICATION_TYPES,
  isValidPeriod,
  getCacheTTL,
} from '../config.js';

describe('Config', () => {
  describe('VALID_PERIODS', () => {
    test('contains expected periods', () => {
      expect(VALID_PERIODS).toContain('current');
      expect(VALID_PERIODS).toContain('hourly');
      expect(VALID_PERIODS).toContain('today');
      expect(VALID_PERIODS).toContain('tomorrow');
      expect(VALID_PERIODS).toContain('3days');
      expect(VALID_PERIODS).toContain('week');
    });

    test('does not contain removed periods', () => {
      expect(VALID_PERIODS).not.toContain('10days');
      expect(VALID_PERIODS).not.toContain('2weeks');
      expect(VALID_PERIODS).not.toContain('month');
    });

    test('has correct number of periods', () => {
      expect(VALID_PERIODS).toHaveLength(7);
    });
  });

  describe('DEFAULT_PERIOD', () => {
    test('is current', () => {
      expect(DEFAULT_PERIOD).toBe('current');
    });

    test('is a valid period', () => {
      expect(VALID_PERIODS).toContain(DEFAULT_PERIOD);
    });
  });

  describe('CACHE_TTL', () => {
    test('has TTL for all valid periods', () => {
      VALID_PERIODS.forEach((period) => {
        expect(CACHE_TTL[period]).toBeDefined();
        expect(typeof CACHE_TTL[period]).toBe('number');
        expect(CACHE_TTL[period]).toBeGreaterThan(0);
      });
    });

    test('has correct TTL values in seconds', () => {
      expect(CACHE_TTL.current).toBe(600); // 10 minutes
      expect(CACHE_TTL.hourly).toBe(900); // 15 minutes
      expect(CACHE_TTL.today).toBe(1800); // 30 minutes
      expect(CACHE_TTL.tomorrow).toBe(1800); // 30 minutes
      expect(CACHE_TTL['3days']).toBe(3600); // 60 minutes
      expect(CACHE_TTL.week).toBe(3600); // 60 minutes
    });
  });

  describe('API_ENDPOINTS', () => {
    test('has auth endpoints', () => {
      expect(API_ENDPOINTS.login).toBe('auth/login/');
      expect(API_ENDPOINTS.register).toBe('auth/register/');
      expect(API_ENDPOINTS.logout).toBe('auth/logout/');
      expect(API_ENDPOINTS.refresh).toBe('auth/refresh/');
      expect(API_ENDPOINTS.me).toBe('auth/me/');
    });

    test('has city endpoints', () => {
      expect(API_ENDPOINTS.cities).toBe('cities/');
      expect(API_ENDPOINTS.citySearch).toBe('cities/search/');
      expect(typeof API_ENDPOINTS.cityDetail).toBe('function');
      expect(API_ENDPOINTS.cityDetail(123)).toBe('cities/123/');
    });

    test('has weather endpoint function', () => {
      expect(typeof API_ENDPOINTS.weather).toBe('function');
      expect(API_ENDPOINTS.weather(1)).toBe('weather/1/?period=current');
      expect(API_ENDPOINTS.weather(1, 'hourly')).toBe('weather/1/?period=hourly');
      expect(API_ENDPOINTS.weather(42, 'week')).toBe('weather/42/?period=week');
    });

    test('has subscription endpoints', () => {
      expect(API_ENDPOINTS.subscriptions).toBe('subscriptions/');
      expect(typeof API_ENDPOINTS.subscriptionDetail).toBe('function');
      expect(API_ENDPOINTS.subscriptionDetail(5)).toBe('subscriptions/5/');
    });

    test('has user profile endpoint', () => {
      expect(API_ENDPOINTS.userProfile).toBe('users/me/');
    });
  });

  describe('PERIOD_LABELS', () => {
    test('has labels for all valid periods', () => {
      VALID_PERIODS.forEach((period) => {
        expect(PERIOD_LABELS[period]).toBeDefined();
        expect(typeof PERIOD_LABELS[period]).toBe('string');
      });
    });

    test('has correct label values', () => {
      expect(PERIOD_LABELS.current).toBe('Now');
      expect(PERIOD_LABELS.hourly).toBe('Hourly');
      expect(PERIOD_LABELS.today).toBe('Today');
      expect(PERIOD_LABELS.tomorrow).toBe('Tomorrow');
      expect(PERIOD_LABELS['3days']).toBe('3 Days');
      expect(PERIOD_LABELS.week).toBe('Week');
    });
  });

  describe('NOTIFICATION_PERIODS', () => {
    test('has period options with value and label', () => {
      expect(Array.isArray(NOTIFICATION_PERIODS)).toBe(true);
      expect(NOTIFICATION_PERIODS.length).toBeGreaterThan(0);

      NOTIFICATION_PERIODS.forEach((option) => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('number');
        expect(typeof option.label).toBe('string');
      });
    });

    test('has expected options', () => {
      const values = NOTIFICATION_PERIODS.map((o) => o.value);
      expect(values).toContain(1);
      expect(values).toContain(6);
      expect(values).toContain(12);
    });
  });

  describe('NOTIFICATION_TYPES', () => {
    test('has notification type options', () => {
      expect(Array.isArray(NOTIFICATION_TYPES)).toBe(true);

      NOTIFICATION_TYPES.forEach((option) => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
      });
    });

    test('includes email, webhook, and both', () => {
      const values = NOTIFICATION_TYPES.map((o) => o.value);
      expect(values).toContain('email');
      expect(values).toContain('webhook');
      expect(values).toContain('both');
    });
  });

  describe('isValidPeriod', () => {
    test('returns true for valid periods', () => {
      VALID_PERIODS.forEach((period) => {
        expect(isValidPeriod(period)).toBe(true);
      });
    });

    test('returns false for invalid periods', () => {
      expect(isValidPeriod('10days')).toBe(false);
      expect(isValidPeriod('2weeks')).toBe(false);
      expect(isValidPeriod('month')).toBe(false);
      expect(isValidPeriod('')).toBe(false);
      expect(isValidPeriod(null)).toBe(false);
      expect(isValidPeriod(undefined)).toBe(false);
      expect(isValidPeriod('invalid')).toBe(false);
    });
  });

  describe('getCacheTTL', () => {
    test('returns correct TTL for valid periods', () => {
      expect(getCacheTTL('current')).toBe(600);
      expect(getCacheTTL('hourly')).toBe(900);
      expect(getCacheTTL('week')).toBe(3600);
    });

    test('returns default TTL for invalid periods', () => {
      expect(getCacheTTL('invalid')).toBe(600); // defaults to current
      expect(getCacheTTL(null)).toBe(600);
      expect(getCacheTTL(undefined)).toBe(600);
    });
  });
});

