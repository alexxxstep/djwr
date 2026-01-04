/**
 * Tests for Weather module
 *
 * Tests the unified API response format:
 * {
 *   city: { id, name, country, latitude, longitude },
 *   period: "current" | "hourly" | ...,
 *   meta: { count, fetched_at, cache_ttl },
 *   data: [{ dt, temp, feels_like, humidity, description, ... }]
 * }
 */

import {
  fetchCurrentWeather,
  fetchWeatherForecast,
  fetchHourlyForecast,
  fetchWeeklyForecast,
  updateWeatherDisplay,
  updateHourlyForecast,
  getFirstWeatherItem,
  getWeatherDataArray,
  clearWeatherCache,
} from '../weather.js';
import * as api from '../api.js';
import cache, { Cache } from '../cache.js';

// Mock modules
jest.mock('../api.js', () => ({
  apiGet: jest.fn(),
  handleApiError: jest.fn(),
}));

jest.mock('../cache.js', () => {
  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockCache,
    Cache: {
      weatherKey: (cityId, period) => `weather:${cityId}:${period}`,
      subscriptionsKey: () => 'subscriptions',
    },
  };
});

jest.mock('../config.js', () => ({
  VALID_PERIODS: ['current', 'hourly', 'today', 'tomorrow', '3days', 'week'],
  DEFAULT_PERIOD: 'current',
  API_ENDPOINTS: {
    weather: (cityId, period = 'current') => `weather/${cityId}/?period=${period}`,
  },
  isValidPeriod: (period) =>
    ['current', 'hourly', 'today', 'tomorrow', '3days', 'week'].includes(period),
  getCacheTTL: (period) => {
    const ttl = { current: 600, hourly: 900, today: 1800, week: 3600 };
    return ttl[period] || 600;
  },
}));

jest.mock('../icons.js', () => ({
  getWeatherIcon: jest.fn(() => ({
    tagName: 'DIV',
    innerHTML: '<svg></svg>',
    querySelector: jest.fn(),
  })),
  formatTemperature: jest.fn((temp) => (temp !== null && temp !== undefined ? `${Math.round(temp)}°C` : '--')),
  formatTime: jest.fn(() => '12:00 PM'),
  formatDate: jest.fn(() => 'Monday 12:00 PM'),
}));

// Mock DOM
const mockElements = {};

describe('Weather', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock elements
    Object.keys(mockElements).forEach((key) => delete mockElements[key]);

    global.document.getElementById = jest.fn((id) => {
      if (!mockElements[id]) {
        mockElements[id] = {
          textContent: '',
          innerHTML: '',
          className: '',
          classList: { add: jest.fn(), remove: jest.fn() },
          appendChild: jest.fn(),
          querySelector: jest.fn(() => null),
          querySelectorAll: jest.fn(() => []),
        };
      }
      return mockElements[id];
    });
    global.document.querySelector = jest.fn(() => null);
    global.document.querySelectorAll = jest.fn(() => []);

    // Cache returns null by default (no cache)
    cache.get.mockReturnValue(null);
  });

  describe('fetchWeatherForecast', () => {
    test('fetches weather with default period', async () => {
      const mockResponse = {
        city: { id: 1, name: 'Kyiv', country: 'UA' },
        period: 'current',
        meta: { count: 1, fetched_at: '2026-01-03T12:00:00Z', cache_ttl: 600 },
        data: [{ dt: 1735905600, temp: 15, description: 'sunny' }],
      };

      api.apiGet.mockResolvedValueOnce(mockResponse);

      const result = await fetchWeatherForecast(1);

      expect(api.apiGet).toHaveBeenCalledWith('weather/1/?period=current');
      expect(cache.set).toHaveBeenCalledWith('weather:1:current', mockResponse, 600);
      expect(result).toEqual(mockResponse);
    });

    test('fetches weather for specific period', async () => {
      const mockResponse = {
        city: { id: 1, name: 'Kyiv' },
        period: 'hourly',
        meta: { count: 24, fetched_at: '2026-01-03T12:00:00Z', cache_ttl: 900 },
        data: [{ dt: 1735905600, temp: 15 }],
      };

      api.apiGet.mockResolvedValueOnce(mockResponse);

      const result = await fetchWeatherForecast(1, 'hourly');

      expect(api.apiGet).toHaveBeenCalledWith('weather/1/?period=hourly');
      expect(result).toEqual(mockResponse);
    });

    test('returns cached data if available', async () => {
      const cachedData = {
        city: { id: 1, name: 'Kyiv' },
        period: 'current',
        data: [{ temp: 15 }],
      };

      cache.get.mockReturnValue(cachedData);

      const result = await fetchWeatherForecast(1, 'current');

      expect(api.apiGet).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    test('skips cache when useCache is false', async () => {
      const cachedData = { data: [{ temp: 15 }] };
      const freshData = { data: [{ temp: 16 }] };

      cache.get.mockReturnValue(cachedData);
      api.apiGet.mockResolvedValueOnce(freshData);

      const result = await fetchWeatherForecast(1, 'current', false);

      expect(api.apiGet).toHaveBeenCalled();
      expect(result).toEqual(freshData);
    });

    test('falls back to default period for invalid period', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockResponse = { city: { id: 1 }, period: 'current', data: [] };

      api.apiGet.mockResolvedValueOnce(mockResponse);

      await fetchWeatherForecast(1, 'invalid-period');

      expect(consoleSpy).toHaveBeenCalledWith('Invalid period "invalid-period", using "current"');
      expect(api.apiGet).toHaveBeenCalledWith('weather/1/?period=current');

      consoleSpy.mockRestore();
    });

    test('handles fetch error', async () => {
      const error = new Error('Weather API error');
      api.apiGet.mockRejectedValueOnce(error);

      await expect(fetchWeatherForecast(1)).rejects.toThrow('Weather API error');
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('fetchCurrentWeather', () => {
    test('calls fetchWeatherForecast with current period', async () => {
      const mockResponse = {
        city: { id: 1, name: 'Kyiv' },
        period: 'current',
        data: [{ temp: 15 }],
      };

      api.apiGet.mockResolvedValueOnce(mockResponse);

      const result = await fetchCurrentWeather(1);

      expect(api.apiGet).toHaveBeenCalledWith('weather/1/?period=current');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchHourlyForecast', () => {
    test('calls fetchWeatherForecast with hourly period', async () => {
      const mockResponse = {
        city: { id: 1 },
        period: 'hourly',
        data: [{ temp: 15 }, { temp: 16 }],
      };

      api.apiGet.mockResolvedValueOnce(mockResponse);

      const result = await fetchHourlyForecast(1);

      expect(api.apiGet).toHaveBeenCalledWith('weather/1/?period=hourly');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('fetchWeeklyForecast', () => {
    test('calls fetchWeatherForecast with week period', async () => {
      const mockResponse = {
        city: { id: 1 },
        period: 'week',
        data: [{ temp: 15 }],
      };

      api.apiGet.mockResolvedValueOnce(mockResponse);

      const result = await fetchWeeklyForecast(1);

      expect(api.apiGet).toHaveBeenCalledWith('weather/1/?period=week');
    });
  });

  describe('getWeatherDataArray', () => {
    test('extracts data array from unified response', () => {
      const response = {
        city: { id: 1 },
        period: 'hourly',
        data: [{ temp: 15 }, { temp: 16 }],
      };

      const result = getWeatherDataArray(response);

      expect(result).toEqual([{ temp: 15 }, { temp: 16 }]);
    });

    test('returns empty array for null response', () => {
      expect(getWeatherDataArray(null)).toEqual([]);
    });

    test('returns empty array for response without data', () => {
      expect(getWeatherDataArray({})).toEqual([]);
      expect(getWeatherDataArray({ city: { id: 1 } })).toEqual([]);
    });

    test('returns empty array for non-array data', () => {
      expect(getWeatherDataArray({ data: 'not-array' })).toEqual([]);
    });
  });

  describe('getFirstWeatherItem', () => {
    test('extracts first item from unified response', () => {
      const response = {
        city: { id: 1 },
        period: 'current',
        data: [
          { temp: 15, description: 'sunny' },
          { temp: 16, description: 'cloudy' },
        ],
      };

      const result = getFirstWeatherItem(response);

      expect(result).toEqual({ temp: 15, description: 'sunny' });
    });

    test('returns null for empty data array', () => {
      expect(getFirstWeatherItem({ data: [] })).toBeNull();
    });

    test('returns null for null response', () => {
      expect(getFirstWeatherItem(null)).toBeNull();
    });

    test('returns null for response without data', () => {
      expect(getFirstWeatherItem({})).toBeNull();
    });
  });

  describe('updateWeatherDisplay', () => {
    test('updates weather display with unified format', () => {
      const weatherResponse = {
        city: { id: 1, name: 'Kyiv' },
        period: 'current',
        meta: { count: 1, fetched_at: '2026-01-03T12:00:00Z' },
        data: [
          {
            temp: 15,
            feels_like: 14,
            description: 'sunny',
            humidity: 65,
            wind_speed: 3.2,
          },
        ],
      };

      const mockContainer = {
        innerHTML: '',
        appendChild: jest.fn(),
      };

      const mockClone = {
        getElementById: jest.fn((id) => ({
          textContent: '',
          innerHTML: '',
          appendChild: jest.fn(),
        })),
      };

      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => mockClone),
        },
      };

      mockElements['current-weather-content'] = mockContainer;
      mockElements['weather-card-template'] = mockTemplate;

      updateWeatherDisplay(weatherResponse);

      expect(mockContainer.innerHTML).toBe('');
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    test('shows message when no weather data', () => {
      const weatherResponse = {
        city: { id: 1, name: 'Kyiv' },
        period: 'current',
        data: [],
      };

      const mockContainer = { innerHTML: '' };
      mockElements['current-weather-content'] = mockContainer;
      mockElements['weather-card-template'] = { content: {} };

      updateWeatherDisplay(weatherResponse);

      expect(mockContainer.innerHTML).toContain('No weather data available');
    });

    test('handles missing container gracefully', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => updateWeatherDisplay({ data: [] })).not.toThrow();
    });
  });

  describe('updateHourlyForecast', () => {
    test('shows message for empty data', () => {
      const mockContainer = { innerHTML: '' };
      mockElements['hourly-forecast-container'] = mockContainer;
      mockElements['hourly-item-template'] = { content: {} };

      updateHourlyForecast([]);

      expect(mockContainer.innerHTML).toContain('No forecast data available');
    });

    test('handles null data', () => {
      const mockContainer = { innerHTML: '' };
      mockElements['hourly-forecast-container'] = mockContainer;
      mockElements['hourly-item-template'] = { content: {} };

      updateHourlyForecast(null);

      expect(mockContainer.innerHTML).toContain('No forecast data available');
    });

    test('handles missing container gracefully', () => {
      mockElements['hourly-forecast-container'] = null;
      global.document.getElementById.mockReturnValue(null);

      expect(() => updateHourlyForecast([{ dt: Date.now(), temp: 15 }])).not.toThrow();
    });

    test('handles missing template gracefully', () => {
      const mockContainer = { innerHTML: '' };
      mockElements['hourly-forecast-container'] = mockContainer;
      mockElements['hourly-item-template'] = null;

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'hourly-forecast-container') return mockContainer;
        if (id === 'hourly-item-template') return null;
        return null;
      });

      expect(() => updateHourlyForecast([{ dt: Date.now(), temp: 15 }])).not.toThrow();
    });
  });

  describe('clearWeatherCache', () => {
    test('clears cache for specific city', () => {
      clearWeatherCache(1);

      // Should call delete for each valid period
      expect(cache.delete).toHaveBeenCalledWith('weather:1:current');
      expect(cache.delete).toHaveBeenCalledWith('weather:1:hourly');
      expect(cache.delete).toHaveBeenCalledWith('weather:1:today');
      expect(cache.delete).toHaveBeenCalledWith('weather:1:week');
    });

    test('clears all cache when no city specified', () => {
      clearWeatherCache();

      expect(cache.clear).toHaveBeenCalled();
    });
  });
});
