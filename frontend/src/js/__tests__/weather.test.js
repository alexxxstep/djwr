/**
 * Tests for Weather module
 */

import {
  fetchCurrentWeather,
  fetchWeatherForecast,
  fetchHourlyForecast,
  fetchWeeklyForecast,
  updateWeatherDisplay,
  updateHourlyForecast,
  updateAirConditions,
} from '../weather.js';
import * as api from '../api.js';
import * as icons from '../icons.js';

// Mock modules
jest.mock('../api.js', () => ({
  apiRequest: jest.fn(),
  handleApiError: jest.fn(),
}));

jest.mock('../icons.js', () => ({
  getWeatherIcon: jest.fn(),
  formatTemperature: jest.fn(),
  formatTime: jest.fn(),
  formatDate: jest.fn(),
}));

// Mock DOM
const mockElements = {};

describe('Weather', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.document.getElementById = jest.fn((id) => {
      if (!mockElements[id]) {
        mockElements[id] = {
          textContent: '',
          innerHTML: '',
          classList: { add: jest.fn(), remove: jest.fn() },
        };
      }
      return mockElements[id];
    });
    global.document.querySelector = jest.fn(() => null);
    global.document.querySelectorAll = jest.fn(() => []);
  });

  describe('fetchCurrentWeather', () => {
    test('fetches current weather successfully', async () => {
      const mockWeather = {
        temperature: 15,
        humidity: 65,
        description: 'sunny',
        city: { id: 1, name: 'Kyiv' },
      };

      api.apiRequest.mockResolvedValueOnce(mockWeather);

      const result = await fetchCurrentWeather(1);

      expect(api.apiRequest).toHaveBeenCalledWith('weather/1/?period=current');
      expect(result).toEqual(mockWeather);
    });

    test('handles fetch error', async () => {
      const error = new Error('Weather API error');
      api.apiRequest.mockRejectedValueOnce(error);

      await expect(fetchCurrentWeather(1)).rejects.toThrow('Weather API error');
    });
  });

  describe('fetchWeatherForecast', () => {
    test('fetches forecast for specific period', async () => {
      const mockForecast = {
        temperature: 20,
        period: 'today',
      };

      api.apiRequest.mockResolvedValueOnce(mockForecast);

      const result = await fetchWeatherForecast(1, 'today');

      expect(api.apiRequest).toHaveBeenCalledWith('weather/1/?period=today');
      expect(result).toEqual(mockForecast);
    });

    test('defaults to current period', async () => {
      api.apiRequest.mockResolvedValueOnce({});

      await fetchWeatherForecast(1);

      expect(api.apiRequest).toHaveBeenCalledWith('weather/1/?period=current');
    });
  });

  describe('fetchHourlyForecast', () => {
    test('fetches hourly forecast', async () => {
      const mockHourly = {
        list: [
          { time: '12:00', temperature: 15 },
          { time: '13:00', temperature: 16 },
        ],
      };

      api.apiRequest.mockResolvedValueOnce(mockHourly);

      const result = await fetchHourlyForecast(1);

      expect(api.apiRequest).toHaveBeenCalledWith('weather/1/?period=hourly');
      expect(result).toEqual(mockHourly);
    });
  });

  describe('fetchWeeklyForecast', () => {
    test('fetches weekly forecast', async () => {
      const mockWeekly = {
        list: [
          { date: '2024-01-01', temperature: 15 },
          { date: '2024-01-02', temperature: 16 },
        ],
      };

      api.apiRequest.mockResolvedValueOnce(mockWeekly);

      const result = await fetchWeeklyForecast(1);

      expect(api.apiRequest).toHaveBeenCalledWith('weather/1/?period=week');
      expect(result).toEqual(mockWeekly);
    });
  });

  describe('updateWeatherDisplay', () => {
    test('updates weather display elements', () => {
      const weatherData = {
        temperature: 15,
        description: 'sunny',
        humidity: 65,
        pressure: 1013,
        wind_speed: 3.2,
        city: { name: 'Kyiv' },
      };

      const mockElement = {
        textContent: '',
        innerHTML: '',
        classList: { add: jest.fn(), remove: jest.fn() },
      };

      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => ({
            getElementById: jest.fn(() => mockElement),
          })),
        },
      };

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'current-weather-content') return mockElement;
        if (id === 'weather-display-template') return mockTemplate;
        return null;
      });

      icons.formatTemperature.mockReturnValue('15°');
      icons.getWeatherIcon.mockReturnValue(document.createElement('div'));

      updateWeatherDisplay(weatherData);

      expect(global.document.getElementById).toHaveBeenCalled();
    });
  });

  describe('updateHourlyForecast', () => {
    test('updates hourly forecast display', () => {
      const hourlyData = [
        { dt: 1609459200, temp: 15, weather: [{ description: 'sunny' }] },
        { dt: 1609462800, temp: 16, weather: [{ description: 'cloudy' }] },
      ];

      const mockContainer = {
        innerHTML: '',
        appendChild: jest.fn(),
      };

      const mockElement = {
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn(),
      };

      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => ({
            getElementById: jest.fn(() => mockElement),
          })),
        },
      };

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'hourly-forecast-container') return mockContainer;
        if (id === 'hourly-item-template') return mockTemplate;
        return null;
      });

      icons.formatTime.mockReturnValue('12:00');
      icons.formatTemperature.mockReturnValue('15°');
      icons.getWeatherIcon.mockReturnValue(document.createElement('div'));

      updateHourlyForecast(hourlyData);

      expect(mockContainer.innerHTML).toBe('');
      expect(mockTemplate.content.cloneNode).toHaveBeenCalled();
    });

    test('handles empty hourly data', () => {
      const container = { innerHTML: '' };
      global.document.getElementById.mockReturnValue(container);

      updateHourlyForecast([]);

      // Function returns early when data is empty, so innerHTML stays empty
      expect(container.innerHTML).toBe('');
    });

    test('handles null hourly data', () => {
      const container = { innerHTML: '' };
      global.document.getElementById.mockReturnValue(container);

      updateHourlyForecast(null);

      expect(container.innerHTML).toBe('');
    });
  });

  describe('updateAirConditions', () => {
    test('updates air conditions display', () => {
      const weatherData = {
        feels_like: 14,
        humidity: 65,
        wind_speed: 3.2,
        uvi: 3,
        pop: 0,
      };

      const mockContainer = {
        innerHTML: '',
        appendChild: jest.fn(),
      };

      const mockElement = {
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn(),
      };

      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => ({
            getElementById: jest.fn(() => mockElement),
            querySelector: jest.fn(() => mockElement),
          })),
        },
      };

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'air-conditions-grid') return mockContainer;
        if (id === 'air-condition-item-template') return mockTemplate;
        return null;
      });

      icons.formatTemperature.mockReturnValue('14°');

      updateAirConditions(weatherData);

      expect(mockContainer.innerHTML).toBe('');
      expect(mockTemplate.content.cloneNode).toHaveBeenCalled();
    });
  });
});

