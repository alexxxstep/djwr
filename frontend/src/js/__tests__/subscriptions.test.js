/**
 * Tests for Subscriptions module
 */

import {
  getUserSubscriptions,
  loadSubscribedCitiesWithWeather,
  renderSubscribedCitiesList,
  selectCityFromList,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  addNewLocation,
  getCurrentSelectedCityId,
} from '../subscriptions.js';
import * as api from '../api.js';
import * as weather from '../weather.js';
import * as icons from '../icons.js';

// Mock modules
jest.mock('../api.js', () => ({
  apiRequest: jest.fn(),
  handleApiError: jest.fn(),
}));

jest.mock('../weather.js', () => ({
  fetchCurrentWeather: jest.fn(),
}));

jest.mock('../icons.js', () => ({
  getWeatherIcon: jest.fn(),
  formatTemperature: jest.fn(),
  formatTime: jest.fn(),
  formatDate: jest.fn(),
}));

// Mock DOM
const mockListContainer = {
  innerHTML: '',
  appendChild: jest.fn(),
};

const mockTemplate = {
  content: {
    cloneNode: jest.fn(() => ({
      querySelector: jest.fn(() => ({
        setAttribute: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
      })),
      getElementById: jest.fn(() => ({
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn(),
      })),
    })),
  },
};

describe('Subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.document.getElementById = jest.fn((id) => {
      if (id === 'subscribed-cities-list') return mockListContainer;
      if (id === 'city-list-item-template') return mockTemplate;
      if (id === 'cities-count') return { textContent: '' };
      return null;
    });
    global.document.querySelectorAll = jest.fn(() => []);
    global.document.querySelector = jest.fn(() => null);
    global.document.dispatchEvent = jest.fn();
  });

  describe('getUserSubscriptions', () => {
    test('returns subscriptions from API', async () => {
      const mockSubscriptions = {
        results: [
          { id: 1, city: { id: 1, name: 'Kyiv' } },
          { id: 2, city: { id: 2, name: 'London' } },
        ],
        count: 2,
      };

      api.apiRequest.mockResolvedValueOnce(mockSubscriptions);

      const result = await getUserSubscriptions();

      expect(api.apiRequest).toHaveBeenCalledWith('subscriptions/');
      expect(result).toEqual(mockSubscriptions.results);
    });

    test('handles direct array response', async () => {
      const mockSubscriptions = [
        { id: 1, city: { id: 1, name: 'Kyiv' } },
        { id: 2, city: { id: 2, name: 'London' } },
      ];

      api.apiRequest.mockResolvedValueOnce(mockSubscriptions);

      const result = await getUserSubscriptions();

      expect(result).toEqual(mockSubscriptions);
    });

    test('returns empty array on 401 error', async () => {
      const error = new Error('401 Unauthorized');
      error.status = 401;
      api.apiRequest.mockRejectedValueOnce(error);

      const result = await getUserSubscriptions();

      expect(result).toEqual([]);
    });

    test('returns empty array on other errors', async () => {
      const error = new Error('Network error');
      api.apiRequest.mockRejectedValueOnce(error);

      const result = await getUserSubscriptions();

      expect(result).toEqual([]);
    });
  });

  describe('loadSubscribedCitiesWithWeather', () => {
    test('loads subscriptions with weather data', async () => {
      const mockSubscriptions = [
        {
          id: 1,
          city: { id: 1, name: 'Kyiv', country: 'UA' },
        },
        {
          id: 2,
          city: { id: 2, name: 'London', country: 'GB' },
        },
      ];

      const mockWeather1 = { temperature: 15, description: 'sunny' };
      const mockWeather2 = { temperature: 10, description: 'cloudy' };

      api.apiRequest.mockResolvedValueOnce({ results: mockSubscriptions });
      weather.fetchCurrentWeather
        .mockResolvedValueOnce(mockWeather1)
        .mockResolvedValueOnce(mockWeather2);

      const result = await loadSubscribedCitiesWithWeather();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        subscription: mockSubscriptions[0],
        city: mockSubscriptions[0].city,
        weather: mockWeather1,
      });
      expect(result[1]).toEqual({
        subscription: mockSubscriptions[1],
        city: mockSubscriptions[1].city,
        weather: mockWeather2,
      });
    });

    test('handles missing weather data gracefully', async () => {
      const mockSubscriptions = [
        {
          id: 1,
          city: { id: 1, name: 'Kyiv' },
        },
      ];

      api.apiRequest.mockResolvedValueOnce({ results: mockSubscriptions });
      weather.fetchCurrentWeather.mockRejectedValueOnce(new Error('Weather API error'));

      const result = await loadSubscribedCitiesWithWeather();

      expect(result).toHaveLength(1);
      expect(result[0].weather).toBeNull();
    });

    test('returns empty array when no subscriptions', async () => {
      api.apiRequest.mockResolvedValueOnce({ results: [] });

      const result = await loadSubscribedCitiesWithWeather();

      expect(result).toEqual([]);
    });
  });

  describe('createSubscription', () => {
    test('creates subscription successfully', async () => {
      const mockResponse = {
        id: 1,
        city_id: 1,
        period: 6,
        forecast_period: 'current',
        notification_type: 'email',
      };

      api.apiRequest.mockResolvedValueOnce(mockResponse);

      const result = await createSubscription(1, 6, 'current', 'email');

      expect(api.apiRequest).toHaveBeenCalledWith('subscriptions/', {
        method: 'POST',
        body: JSON.stringify({
          city_id: 1,
          period: 6,
          forecast_period: 'current',
          notification_type: 'email',
          is_active: true,
        }),
      });
      expect(result).toEqual(mockResponse);
    });

    test('handles creation error', async () => {
      const error = new Error('Already subscribed');
      error.response = { city_id: ['You are already subscribed to this city.'] };
      api.apiRequest.mockRejectedValueOnce(error);

      await expect(createSubscription(1, 6, 'current', 'email')).rejects.toThrow('Already subscribed');
    });
  });

  describe('updateSubscription', () => {
    test('updates subscription successfully', async () => {
      const mockResponse = {
        id: 1,
        period: 12,
        is_active: false,
      };

      api.apiRequest.mockResolvedValueOnce(mockResponse);

      const result = await updateSubscription(1, { period: 12, is_active: false });

      expect(api.apiRequest).toHaveBeenCalledWith('subscriptions/1/', {
        method: 'PATCH',
        body: JSON.stringify({ period: 12, is_active: false }),
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteSubscription', () => {
    test('deletes subscription successfully', async () => {
      api.apiRequest.mockResolvedValueOnce({});

      const result = await deleteSubscription(1);

      expect(api.apiRequest).toHaveBeenCalledWith('subscriptions/1/', {
        method: 'DELETE',
      });
      expect(result).toBe(true);
    });

    test('handles deletion error', async () => {
      const error = new Error('Not found');
      api.apiRequest.mockRejectedValueOnce(error);

      await expect(deleteSubscription(999)).rejects.toThrow('Not found');
    });
  });

  describe('renderSubscribedCitiesList', () => {
    test('renders cities list', () => {
      const citiesData = [
        {
          subscription: { id: 1 },
          city: { id: 1, name: 'Kyiv' },
          weather: { temperature: 15, description: 'sunny', fetched_at: '2024-01-01T12:00:00Z' },
        },
      ];

      const mockListItem = {
        setAttribute: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
      };

      const mockClone = {
        querySelector: jest.fn(() => mockListItem),
        getElementById: jest.fn(() => ({
          textContent: '',
          innerHTML: '',
          appendChild: jest.fn(),
        })),
      };

      mockTemplate.content.cloneNode.mockReturnValue(mockClone);

      icons.formatTime.mockReturnValue('12:00 PM');
      icons.formatTemperature.mockReturnValue('15°');
      icons.getWeatherIcon.mockReturnValue(document.createElement('div'));

      renderSubscribedCitiesList(citiesData);

      expect(mockListContainer.innerHTML).toBe('');
      expect(mockListContainer.appendChild).toHaveBeenCalled();
    });

    test('displays empty state when no cities', () => {
      renderSubscribedCitiesList([]);

      expect(mockListContainer.innerHTML).toContain('No subscribed cities');
    });

    test('updates cities count', () => {
      const countEl = { textContent: '' };
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'cities-count') return countEl;
        if (id === 'subscribed-cities-list') return mockListContainer;
        if (id === 'city-list-item-template') return mockTemplate;
        return null;
      });

      const mockClone = {
        querySelector: jest.fn(() => ({
          setAttribute: jest.fn(),
          classList: { add: jest.fn(), remove: jest.fn() },
          addEventListener: jest.fn(),
        })),
        getElementById: jest.fn(() => ({
          textContent: '',
          innerHTML: '',
          appendChild: jest.fn(),
        })),
      };

      mockTemplate.content.cloneNode.mockReturnValue(mockClone);
      icons.formatTime.mockReturnValue('12:00 PM');
      icons.formatTemperature.mockReturnValue('15°');
      icons.getWeatherIcon.mockReturnValue(document.createElement('div'));

      const citiesData = [
        { subscription: { id: 1 }, city: { id: 1 }, weather: {} },
        { subscription: { id: 2 }, city: { id: 2 }, weather: {} },
      ];

      renderSubscribedCitiesList(citiesData);

      // textContent is set as number (citiesData.length), convert to string for comparison
      expect(String(countEl.textContent)).toBe('2');
    });
  });

  describe('selectCityFromList', () => {
    test('selects city and dispatches event', () => {
      const mockListItems = [
        {
          getAttribute: jest.fn(() => '1'),
          classList: { add: jest.fn(), remove: jest.fn() },
        },
        {
          getAttribute: jest.fn(() => '2'),
          classList: { add: jest.fn(), remove: jest.fn() },
        },
      ];

      global.document.querySelectorAll.mockReturnValue(mockListItems);

      selectCityFromList(1);

      expect(mockListItems[0].classList.add).toHaveBeenCalledWith('active');
      expect(mockListItems[1].classList.remove).toHaveBeenCalledWith('active');
      expect(global.document.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('addNewLocation', () => {
    test('focuses search input', () => {
      const mockInput = { focus: jest.fn() };
      global.document.getElementById.mockReturnValue(mockInput);

      addNewLocation();

      expect(mockInput.focus).toHaveBeenCalled();
    });
  });

  describe('getCurrentSelectedCityId', () => {
    test('returns current selected city ID', () => {
      // Set initial value
      selectCityFromList(5);
      const id = getCurrentSelectedCityId();

      expect(id).toBe(5);
    });
  });
});

