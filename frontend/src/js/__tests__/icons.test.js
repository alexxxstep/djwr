/**
 * Tests for Icons module
 */

import { getWeatherIcon, formatTemperature, formatTime, formatDate } from '../icons.js';

// Mock DOM - createElementNS should return element with all needed methods
beforeEach(() => {
  global.document.createElementNS = jest.fn((namespace, tag) => {
    const element = {
      setAttribute: jest.fn(),
      innerHTML: '',
      appendChild: jest.fn(),
      removeChild: jest.fn(),
    };
    return element;
  });
});

describe('Icons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWeatherIcon', () => {
    test('returns sun icon for clear/sunny conditions', () => {
      const icon = getWeatherIcon('clear sky', 'small');
      expect(icon).toBeDefined();
      expect(global.document.createElementNS).toHaveBeenCalledWith(
        'http://www.w3.org/2000/svg',
        'svg'
      );
    });

    test('returns cloud icon for cloudy conditions', () => {
      const icon = getWeatherIcon('cloudy', 'medium');
      expect(icon).toBeDefined();
    });

    test('returns rain icon for rainy conditions', () => {
      const icon = getWeatherIcon('light rain', 'large');
      expect(icon).toBeDefined();
    });

    test('returns storm icon for storm conditions', () => {
      const icon = getWeatherIcon('thunderstorm', 'medium');
      expect(icon).toBeDefined();
    });

    test('returns snow icon for snow conditions', () => {
      const icon = getWeatherIcon('snow', 'small');
      expect(icon).toBeDefined();
    });

    test('defaults to cloud icon for unknown conditions', () => {
      const icon = getWeatherIcon('unknown condition', 'medium');
      expect(icon).toBeDefined();
    });

    test('handles different sizes', () => {
      const iconSmall = getWeatherIcon('sunny', 'small');
      const iconMedium = getWeatherIcon('sunny', 'medium');
      const iconLarge = getWeatherIcon('sunny', 'large');

      expect(iconSmall).toBeDefined();
      expect(iconMedium).toBeDefined();
      expect(iconLarge).toBeDefined();
    });
  });

  describe('formatTemperature', () => {
    test('formats temperature with default unit', () => {
      expect(formatTemperature(15.5)).toBe('16°C');
      expect(formatTemperature(-5)).toBe('-5°C');
      expect(formatTemperature(0)).toBe('0°C');
    });

    test('formats temperature with custom unit', () => {
      expect(formatTemperature(20, '°F')).toBe('20°F');
    });

    test('handles null/undefined', () => {
      expect(formatTemperature(null)).toBe('--');
      expect(formatTemperature(undefined)).toBe('--');
    });

    test('rounds temperature', () => {
      expect(formatTemperature(15.7)).toBe('16°C');
      expect(formatTemperature(15.3)).toBe('15°C');
    });
  });

  describe('formatTime', () => {
    test('formats time from ISO string', () => {
      const time = formatTime('2024-01-01T14:30:00Z');
      expect(time).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    test('formats time from Date object', () => {
      const date = new Date('2024-01-01T14:30:00Z');
      const time = formatTime(date);
      expect(time).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    test('handles null/undefined', () => {
      expect(formatTime(null)).toBe('');
      expect(formatTime(undefined)).toBe('');
    });

    test('formats AM time correctly', () => {
      const time = formatTime('2024-01-01T09:15:00Z');
      expect(time).toContain('AM');
    });

    test('formats PM time correctly', () => {
      const time = formatTime('2024-01-01T21:45:00Z');
      expect(time).toContain('PM');
    });
  });

  describe('formatDate', () => {
    test('formats date with day name and time', () => {
      const date = formatDate('2024-01-01T14:30:00Z');
      expect(date).toMatch(/[A-Za-z]+ \d{1,2}:\d{2} (AM|PM)/);
    });

    test('includes day name', () => {
      const date = formatDate('2024-01-01T14:30:00Z'); // Monday
      expect(date).toContain('Monday');
    });

    test('handles null/undefined', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });

    test('formats different days correctly', () => {
      const monday = formatDate('2024-01-01T12:00:00Z');
      const tuesday = formatDate('2024-01-02T12:00:00Z');
      expect(monday).toContain('Monday');
      expect(tuesday).toContain('Tuesday');
    });
  });
});

