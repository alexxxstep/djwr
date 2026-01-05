/**
 * Tests for City Search module
 */

import {
  searchCities,
  displaySearchResults,
  hideSearchResults,
  selectCity,
  initSearch,
} from '../search.js';
import * as api from '../api.js';
import * as subscriptions from '../subscriptions.js';

// Mock API module
jest.mock('../api.js', () => ({
  apiGet: jest.fn(),
  handleApiError: jest.fn(),
  getAuthToken: jest.fn(),
}));

// Mock subscriptions module
jest.mock('../subscriptions.js', () => ({
  createSubscription: jest.fn(),
  loadSubscribedCitiesWithWeather: jest.fn(),
  renderSubscribedCitiesList: jest.fn(),
  showSubscriptionSettingsModal: jest.fn(),
}));

// Mock config
jest.mock('../config.js', () => ({
  API_ENDPOINTS: {
    citySearch: 'cities/search/',
  },
}));

// Mock DOM elements
const mockResultsContainer = {
  innerHTML: '',
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
  },
  contains: jest.fn(() => false),
  appendChild: jest.fn(),
};

const mockSearchInput = {
  value: '',
  addEventListener: jest.fn(),
  hasAttribute: jest.fn(() => false),
  setAttribute: jest.fn(),
};

describe('City Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset mocks
    mockResultsContainer.innerHTML = '';
    mockResultsContainer.classList.add.mockClear();
    mockResultsContainer.classList.remove.mockClear();
    mockResultsContainer.appendChild.mockClear();
    mockSearchInput.value = '';
    mockSearchInput.addEventListener.mockClear();
    mockSearchInput.hasAttribute.mockClear().mockReturnValue(false);

    global.document.getElementById = jest.fn((id) => {
      if (id === 'search-results') return mockResultsContainer;
      if (id === 'city-search') return mockSearchInput;
      if (id === 'subscription-modal') return null;
      return null;
    });
    global.document.addEventListener = jest.fn();
    global.document.removeEventListener = jest.fn();
    global.document.dispatchEvent = jest.fn();
    // Create proper mock element that can be used as Node
    const createMockElement = () => {
      const el = {
        className: '',
        innerHTML: '',
        textContent: '',
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        remove: jest.fn(),
        nodeType: 1, // ELEMENT_NODE
      };
      return el;
    };

    global.document.createElement = jest.fn(() => createMockElement());

    // Mock document.body with appendChild that accepts our mock elements
    const originalBody = global.document.body;
    Object.defineProperty(global.document, 'body', {
      value: {
        ...originalBody,
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('searchCities', () => {
    test('searches cities with debounce', async () => {
      const mockResults = [
        { id: 1, name: 'Kyiv', country: 'UA' },
        { id: 2, name: 'London', country: 'GB' },
      ];

      api.apiGet.mockResolvedValueOnce(mockResults);

      const callback = jest.fn();
      searchCities('Kyiv', callback);

      // Fast-forward time
      jest.advanceTimersByTime(300);

      // Wait for async operation
      await Promise.resolve();
      await Promise.resolve();

      expect(api.apiGet).toHaveBeenCalledWith('cities/search/?q=Kyiv');
      expect(callback).toHaveBeenCalledWith(mockResults);
    });

    test('handles paginated response', async () => {
      const mockPaginatedResponse = {
        results: [{ id: 1, name: 'Kyiv', country: 'UA' }],
        count: 1,
      };

      api.apiGet.mockResolvedValueOnce(mockPaginatedResponse);

      const callback = jest.fn();
      searchCities('Kyiv', callback);

      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledWith([{ id: 1, name: 'Kyiv', country: 'UA' }]);
    });

    test('does not search if query is too short', () => {
      const callback = jest.fn();
      searchCities('K', callback);
      jest.advanceTimersByTime(300);

      expect(api.apiGet).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    test('cancels previous search on new input', async () => {
      api.apiGet.mockResolvedValueOnce([{ id: 1, name: 'Kyiv' }]);

      searchCities('Ky');
      searchCities('Kyi');
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();

      expect(api.apiGet).toHaveBeenCalledTimes(1);
      expect(api.apiGet).toHaveBeenCalledWith('cities/search/?q=Kyi');
    });

    test('handles search error', async () => {
      const error = new Error('Search failed');
      api.apiGet.mockRejectedValueOnce(error);

      searchCities('Kyiv');
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();

      expect(api.handleApiError).toHaveBeenCalledWith(error);
      expect(mockResultsContainer.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('displaySearchResults', () => {
    test('displays search results', () => {
      const results = [
        { id: 1, name: 'Kyiv', country: 'UA' },
        { id: 2, name: 'London', country: 'GB' },
      ];

      displaySearchResults(results);

      expect(mockResultsContainer.innerHTML).toBe('');
      expect(mockResultsContainer.appendChild).toHaveBeenCalled();
      expect(mockResultsContainer.classList.remove).toHaveBeenCalledWith('hidden');
    });

    test('displays empty state when no results', () => {
      displaySearchResults([]);

      expect(mockResultsContainer.innerHTML).toContain('No cities found');
      expect(mockResultsContainer.classList.remove).toHaveBeenCalledWith('hidden');
    });

    test('handles null results', () => {
      displaySearchResults(null);

      expect(mockResultsContainer.innerHTML).toContain('No cities found');
    });
  });

  describe('hideSearchResults', () => {
    test('hides search results container', () => {
      hideSearchResults();

      expect(mockResultsContainer.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('selectCity', () => {
    test('selects city and dispatches event (no subscription)', () => {
      const city = { id: 1, name: 'Kyiv', country: 'UA' };

      selectCity(city, false);

      expect(mockSearchInput.value).toBe('');
      expect(global.document.dispatchEvent).toHaveBeenCalled();
      const event = global.document.dispatchEvent.mock.calls[0][0];
      expect(event.detail.city).toEqual(city);
      expect(event.detail.cityId).toBe(1);
    });

    test('shows notification when not authenticated', () => {
      const city = { id: 1, name: 'Kyiv', country: 'UA' };
      api.getAuthToken.mockReturnValueOnce(null);

      selectCity(city, true);

      // Should show notification (creates div element)
      expect(global.document.createElement).toHaveBeenCalled();
    });

    test('shows subscription modal when authenticated and modal exists', () => {
      const city = { id: 1, name: 'Kyiv', country: 'UA' };
      api.getAuthToken.mockReturnValueOnce('token');

      const modal = { classList: { remove: jest.fn() } };
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'subscription-modal') return modal;
        if (id === 'search-results') return mockResultsContainer;
        if (id === 'city-search') return mockSearchInput;
        return null;
      });

      selectCity(city, true);

      expect(subscriptions.showSubscriptionSettingsModal).toHaveBeenCalledWith(null, city);
    });

    test('creates subscription directly when no modal', async () => {
      const city = { id: 1, name: 'Kyiv', country: 'UA' };
      api.getAuthToken.mockReturnValueOnce('token');

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'subscription-modal') return null;
        if (id === 'search-results') return mockResultsContainer;
        if (id === 'city-search') return mockSearchInput;
        return null;
      });

      subscriptions.createSubscription.mockResolvedValueOnce({ id: 1 });
      subscriptions.loadSubscribedCitiesWithWeather.mockResolvedValueOnce([]);

      selectCity(city, true);

      await Promise.resolve();
      await Promise.resolve();

      expect(subscriptions.createSubscription).toHaveBeenCalledWith(city, 6, 'current', 'email', false);
    });
  });

  describe('initSearch', () => {
    test('initializes search input listener', () => {
      initSearch();

      expect(mockSearchInput.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
      expect(mockSearchInput.setAttribute).toHaveBeenCalledWith('data-search-initialized', 'true');
    });

    test('skips initialization if already initialized', () => {
      mockSearchInput.hasAttribute.mockReturnValue(true);

      initSearch();

      expect(mockSearchInput.addEventListener).not.toHaveBeenCalled();
    });

    test('handles missing search input gracefully', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => initSearch()).not.toThrow();
    });

    test('adds click handler for outside clicks', () => {
      initSearch();

      expect(global.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });
});
