/**
 * Tests for Subscriptions module
 *
 * Tests handle unified API response format:
 * {
 *   city: { id, name, country, latitude, longitude },
 *   period: "current" | "hourly" | ...,
 *   meta: { count, fetched_at, cache_ttl },
 *   data: [{ dt, temp, feels_like, humidity, description, ... }]
 * }
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
  showSubscriptionSettingsModal,
  initTimeUpdates,
  stopTimeUpdates,
} from '../subscriptions.js';
import * as api from '../api.js';
import * as weather from '../weather.js';
import cache, { Cache } from '../cache.js';

// Mock modules
jest.mock('../api.js', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
  handleApiError: jest.fn(),
}));

jest.mock('../weather.js', () => ({
  fetchCurrentWeather: jest.fn(),
  getFirstWeatherItem: jest.fn((response) => {
    if (!response?.data || response.data.length === 0) return null;
    return response.data[0];
  }),
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
      subscriptionsKey: () => 'subscriptions',
      weatherKey: (cityId, period) => `weather:${cityId}:${period}`,
    },
  };
});

jest.mock('../config.js', () => ({
  VALID_PERIODS: ['current', 'hourly', 'today', 'tomorrow', '3days', 'week'],
  API_ENDPOINTS: {
    subscriptions: 'subscriptions/',
    subscriptionDetail: (id) => `subscriptions/${id}/`,
  },
}));

jest.mock('../icons.js', () => ({
  getWeatherIcon: jest.fn(() => ({
    tagName: 'DIV',
    innerHTML: '<svg></svg>',
    querySelector: jest.fn(),
  })),
  formatTemperature: jest.fn((temp) => (temp != null ? `${Math.round(temp)}°C` : '--')),
  formatTime: jest.fn((timestamp, timezoneOffset = 0) => {
    if (!timestamp) return '';
    const date = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }),
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
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
      })),
      getElementById: jest.fn(() => ({
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
      })),
    })),
  },
};

describe('Subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset cache mocks
    cache.get.mockReturnValue(null);

    // Reset DOM mocks
    global.document.getElementById = jest.fn((id) => {
      if (id === 'subscribed-cities-list') return mockListContainer;
      if (id === 'city-list-item-template') return mockTemplate;
      if (id === 'cities-count') return { textContent: '' };
      if (id === 'city-search') return { focus: jest.fn() };
      return null;
    });
    global.document.querySelectorAll = jest.fn(() => []);
    global.document.querySelector = jest.fn(() => null);
    global.document.dispatchEvent = jest.fn();
  });

  describe('getUserSubscriptions', () => {
    test('returns subscriptions from API (paginated)', async () => {
      const mockSubscriptions = {
        results: [
          { id: 1, city: { id: 1, name: 'Kyiv' } },
          { id: 2, city: { id: 2, name: 'London' } },
        ],
        count: 2,
      };

      api.apiGet.mockResolvedValueOnce(mockSubscriptions);

      const result = await getUserSubscriptions();

      expect(api.apiGet).toHaveBeenCalledWith('subscriptions/');
      expect(result).toEqual(mockSubscriptions.results);
      expect(cache.set).toHaveBeenCalledWith('subscriptions', mockSubscriptions.results, 60);
    });

    test('handles direct array response', async () => {
      const mockSubscriptions = [
        { id: 1, city: { id: 1, name: 'Kyiv' } },
        { id: 2, city: { id: 2, name: 'London' } },
      ];

      api.apiGet.mockResolvedValueOnce(mockSubscriptions);

      const result = await getUserSubscriptions();

      expect(result).toEqual(mockSubscriptions);
    });

    test('returns cached data when available', async () => {
      const cachedSubscriptions = [{ id: 1, city: { id: 1, name: 'Kyiv' } }];
      cache.get.mockReturnValue(cachedSubscriptions);

      const result = await getUserSubscriptions(true);

      expect(api.apiGet).not.toHaveBeenCalled();
      expect(result).toEqual(cachedSubscriptions);
    });

    test('bypasses cache when useCache is false', async () => {
      cache.get.mockReturnValue([{ cached: true }]);
      api.apiGet.mockResolvedValueOnce({ results: [{ fresh: true }] });

      const result = await getUserSubscriptions(false);

      expect(api.apiGet).toHaveBeenCalled();
      expect(result).toEqual([{ fresh: true }]);
    });

    test('returns empty array on 401 error', async () => {
      const error = new Error('401 Unauthorized');
      error.status = 401;
      api.apiGet.mockRejectedValueOnce(error);

      const result = await getUserSubscriptions();

      expect(result).toEqual([]);
    });

    test('returns empty array and logs other errors', async () => {
      const error = new Error('Network error');
      api.apiGet.mockRejectedValueOnce(error);

      const result = await getUserSubscriptions();

      expect(result).toEqual([]);
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('loadSubscribedCitiesWithWeather', () => {
    test('loads subscriptions and fetches weather', async () => {
      const mockSubscriptions = [
        { id: 1, city: { id: 1, name: 'Kyiv', country: 'UA' } },
        { id: 2, city: { id: 2, name: 'London', country: 'GB' } },
      ];

      const mockWeather1 = {
        city: { id: 1, name: 'Kyiv' },
        period: 'current',
        data: [{ temp: 15, description: 'sunny' }],
      };
      const mockWeather2 = {
        city: { id: 2, name: 'London' },
        period: 'current',
        data: [{ temp: 10, description: 'cloudy' }],
      };

      api.apiGet.mockResolvedValueOnce({ results: mockSubscriptions });
      weather.fetchCurrentWeather
        .mockResolvedValueOnce(mockWeather1)
        .mockResolvedValueOnce(mockWeather2);

      const result = await loadSubscribedCitiesWithWeather();

      expect(result).toHaveLength(2);
      expect(result[0].city.name).toBe('Kyiv');
      expect(result[1].city.name).toBe('London');
      // Verify weather.fetchCurrentWeather was called for each city
      expect(weather.fetchCurrentWeather).toHaveBeenCalledTimes(2);
      expect(weather.fetchCurrentWeather).toHaveBeenCalledWith(1);
      expect(weather.fetchCurrentWeather).toHaveBeenCalledWith(2);
    });

    test('handles missing weather data gracefully', async () => {
      const mockSubscriptions = [{ id: 1, city: { id: 1, name: 'Kyiv' } }];

      api.apiGet.mockResolvedValueOnce({ results: mockSubscriptions });
      weather.fetchCurrentWeather.mockRejectedValueOnce(new Error('Weather API error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await loadSubscribedCitiesWithWeather();

      expect(result).toHaveLength(1);
      expect(result[0].weather).toBeNull();

      consoleSpy.mockRestore();
    });

    test('returns empty array when no subscriptions', async () => {
      api.apiGet.mockResolvedValueOnce({ results: [] });

      const result = await loadSubscribedCitiesWithWeather();

      expect(result).toEqual([]);
      expect(weather.fetchCurrentWeather).not.toHaveBeenCalled();
    });
  });

  describe('createSubscription', () => {
    test('creates subscription with city ID', async () => {
      const mockResponse = {
        id: 1,
        city_id: 1,
        period: 6,
        forecast_period: 'current',
        notification_type: 'email',
      };

      api.apiPost.mockResolvedValueOnce(mockResponse);

      const result = await createSubscription(1, 6, 'current', 'email');

      expect(api.apiPost).toHaveBeenCalledWith('subscriptions/', {
        city_id: 1,
        period: 6,
        forecast_period: 'current',
        notification_type: 'email',
        is_active: false,
      });
      expect(cache.delete).toHaveBeenCalledWith('subscriptions');
      expect(result).toEqual(mockResponse);
    });

    test('creates subscription with city object (has id)', async () => {
      const mockResponse = { id: 1, city_id: 5 };
      api.apiPost.mockResolvedValueOnce(mockResponse);

      const city = { id: 5, name: 'Kyiv', country: 'UA' };
      await createSubscription(city, 6, 'current', 'email', true);

      expect(api.apiPost).toHaveBeenCalledWith('subscriptions/', {
        city_id: 5,
        period: 6,
        forecast_period: 'current',
        notification_type: 'email',
        is_active: true,
      });
    });

    test('creates subscription with city data (no id)', async () => {
      const mockResponse = { id: 1 };
      api.apiPost.mockResolvedValueOnce(mockResponse);

      const city = { name: 'Kyiv', country: 'UA', lat: 50.45, lon: 30.52 };
      await createSubscription(city, 6, 'hourly', 'webhook');

      expect(api.apiPost).toHaveBeenCalledWith('subscriptions/', {
        city_data: {
          name: 'Kyiv',
          country: 'UA',
          lat: 50.45,
          lon: 30.52,
        },
        period: 6,
        forecast_period: 'hourly',
        notification_type: 'webhook',
        is_active: false,
      });
    });

    test('defaults invalid forecast period to current', async () => {
      api.apiPost.mockResolvedValueOnce({ id: 1 });

      await createSubscription(1, 6, 'invalid-period', 'email');

      expect(api.apiPost).toHaveBeenCalledWith('subscriptions/', expect.objectContaining({
        forecast_period: 'current',
      }));
    });

    test('handles creation error', async () => {
      const error = new Error('Already subscribed');
      api.apiPost.mockRejectedValueOnce(error);

      await expect(createSubscription(1, 6, 'current', 'email')).rejects.toThrow('Already subscribed');
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });

    test('throws error for invalid city data', async () => {
      await expect(createSubscription('invalid', 6, 'current', 'email')).rejects.toThrow('Invalid city data');
    });
  });

  describe('updateSubscription', () => {
    test('updates subscription successfully', async () => {
      const mockResponse = { id: 1, period: 12, is_active: false };
      api.apiPatch.mockResolvedValueOnce(mockResponse);

      const result = await updateSubscription(1, { period: 12, is_active: false });

      expect(api.apiPatch).toHaveBeenCalledWith('subscriptions/1/', { period: 12, is_active: false });
      expect(cache.delete).toHaveBeenCalledWith('subscriptions');
      expect(result).toEqual(mockResponse);
    });

    test('handles update error', async () => {
      const error = new Error('Not found');
      api.apiPatch.mockRejectedValueOnce(error);

      await expect(updateSubscription(999, {})).rejects.toThrow('Not found');
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteSubscription', () => {
    test('deletes subscription successfully', async () => {
      api.apiDelete.mockResolvedValueOnce({});

      const result = await deleteSubscription(1);

      expect(api.apiDelete).toHaveBeenCalledWith('subscriptions/1/');
      expect(cache.delete).toHaveBeenCalledWith('subscriptions');
      expect(result).toBe(true);
    });

    test('handles deletion error', async () => {
      const error = new Error('Not found');
      api.apiDelete.mockRejectedValueOnce(error);

      await expect(deleteSubscription(999)).rejects.toThrow('Not found');
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('renderSubscribedCitiesList', () => {
    test('renders cities list with weather data', () => {
      const citiesData = [
        {
          subscription: { id: 1, is_active: true },
          city: { id: 1, name: 'Kyiv', country: 'UA' },
          weather: { temp: 15, description: 'sunny' },
        },
      ];

      const mockListItem = {
        setAttribute: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
        addEventListener: jest.fn(),
        querySelector: jest.fn(() => ({
          setAttribute: jest.fn(),
          addEventListener: jest.fn(),
        })),
      };

      const mockClone = {
        querySelector: jest.fn(() => mockListItem),
        getElementById: jest.fn(() => ({
          textContent: '',
          innerHTML: '',
          appendChild: jest.fn(),
          classList: { add: jest.fn(), remove: jest.fn() },
        })),
      };

      mockTemplate.content.cloneNode.mockReturnValue(mockClone);

      renderSubscribedCitiesList(citiesData);

      expect(mockListContainer.innerHTML).toBe('');
      expect(mockListContainer.appendChild).toHaveBeenCalled();
    });

    test('displays empty state when no cities', () => {
      renderSubscribedCitiesList([]);

      expect(mockListContainer.innerHTML).toContain('No subscribed cities');
    });

    test('updates cities count', () => {
      let countValue = '';
      const countEl = {
        get textContent() { return countValue; },
        set textContent(val) { countValue = val; },
      };

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'cities-count') return countEl;
        if (id === 'subscribed-cities-list') return { innerHTML: '' };
        if (id === 'city-list-item-template') return null;
        return null;
      });

      renderSubscribedCitiesList([
        { subscription: { id: 1 }, city: { id: 1 }, weather: null },
        { subscription: { id: 2 }, city: { id: 2 }, weather: null },
      ]);

      expect(countValue).toBe(2);
    });
  });

  describe('selectCityFromList', () => {
    test('updates selection and dispatches event', async () => {
      const mockItems = [
        {
          getAttribute: jest.fn((attr) => attr === 'data-city-id' ? '1' : null),
          classList: { toggle: jest.fn() },
        },
        {
          getAttribute: jest.fn((attr) => attr === 'data-city-id' ? '2' : null),
          classList: { toggle: jest.fn() },
        },
      ];

      global.document.querySelectorAll.mockReturnValue(mockItems);
      api.apiGet.mockResolvedValueOnce({
        results: [{ city: { id: 1, name: 'Kyiv' } }],
      });

      await selectCityFromList(1);

      expect(mockItems[0].classList.toggle).toHaveBeenCalledWith('active', true);
      expect(mockItems[1].classList.toggle).toHaveBeenCalledWith('active', false);
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

    test('handles missing input gracefully', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => addNewLocation()).not.toThrow();
    });
  });

  describe('getCurrentSelectedCityId', () => {
    test('returns a number or null', () => {
      // getCurrentSelectedCityId returns module state which may be set by previous tests
      const id = getCurrentSelectedCityId();
      // ID should be either a number or null
      expect(id === null || typeof id === 'number').toBe(true);
    });
  });

  describe('showSubscriptionSettingsModal', () => {
    test('handles missing modal gracefully', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => showSubscriptionSettingsModal({}, {})).not.toThrow();
    });

    test('shows modal when modal element exists', () => {
      const mockModal = { classList: { remove: jest.fn(), add: jest.fn() } };
      const mockInput = { value: '', checked: false, style: {} };

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'subscription-modal') return mockModal;
        if (id === 'modal-active-section') return { style: { display: '' } };
        if (id === 'modal-subscribe-btn') return { textContent: '', cloneNode: jest.fn(() => ({})), parentNode: { replaceChild: jest.fn() } };
        if (id === 'modal-cancel-btn') return { cloneNode: jest.fn(() => ({})), parentNode: { replaceChild: jest.fn() } };
        if (id === 'modal-close-btn') return { cloneNode: jest.fn(() => ({})), parentNode: { replaceChild: jest.fn() } };
        if (id === 'modal-unsubscribe-btn') return { classList: { toggle: jest.fn() }, cloneNode: jest.fn(() => ({})), parentNode: { replaceChild: jest.fn() } };
        if (id.startsWith('modal-')) return mockInput;
        return null;
      });

      const subscription = { id: 1, period: 12 };
      const city = { id: 1, name: 'Kyiv', country: 'UA' };

      showSubscriptionSettingsModal(subscription, city);

      expect(mockModal.classList.remove).toHaveBeenCalledWith('hidden');
    });
  });

  describe('Time updates', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('initTimeUpdates starts interval', () => {
      initTimeUpdates();

      // Verify interval is set by advancing time
      jest.advanceTimersByTime(60000);

      // Should not throw
    });

    test('stopTimeUpdates clears interval', () => {
      initTimeUpdates();
      stopTimeUpdates();

      // Should not throw after stopping
      jest.advanceTimersByTime(60000);
    });
  });
});
