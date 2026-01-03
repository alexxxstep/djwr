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
  apiRequest: jest.fn(),
  handleApiError: jest.fn(),
  getAuthToken: jest.fn(),
}));

// Mock subscriptions module
jest.mock('../subscriptions.js', () => ({
  createSubscription: jest.fn(),
  loadSubscribedCitiesWithWeather: jest.fn(),
  renderSubscribedCitiesList: jest.fn(),
}));

// Mock DOM
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
};

describe('City Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    global.document.getElementById = jest.fn((id) => {
      if (id === 'search-results') return mockResultsContainer;
      if (id === 'city-search') return mockSearchInput;
      return null;
    });
    global.document.addEventListener = jest.fn();
    // Don't override document.body, use Object.defineProperty if needed
    if (!global.document.body) {
      global.document.body = { appendChild: jest.fn(), removeChild: jest.fn() };
    }
    global.window.selectCityAndSubscribe = jest.fn();
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

      api.apiRequest.mockResolvedValueOnce(mockResults);

      const callback = jest.fn();
      searchCities('Kyiv', callback);

      // Fast-forward time
      jest.advanceTimersByTime(300);

      await Promise.resolve();

      expect(api.apiRequest).toHaveBeenCalledWith('cities/search/?q=Kyiv');
      expect(callback).toHaveBeenCalledWith(mockResults);
    });

    test('handles paginated response', async () => {
      const mockPaginatedResponse = {
        results: [{ id: 1, name: 'Kyiv', country: 'UA' }],
        count: 1,
      };

      api.apiRequest.mockResolvedValueOnce(mockPaginatedResponse);

      const callback = jest.fn();
      searchCities('Kyiv', callback);

      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(callback).toHaveBeenCalledWith([{ id: 1, name: 'Kyiv', country: 'UA' }]);
    });

    test('does not search if query is too short', () => {
      searchCities('K');
      jest.advanceTimersByTime(300);

      expect(api.apiRequest).not.toHaveBeenCalled();
    });

    test('cancels previous search on new input', () => {
      searchCities('Ky');
      searchCities('Kyi');
      jest.advanceTimersByTime(300);

      expect(api.apiRequest).toHaveBeenCalledTimes(1);
      expect(api.apiRequest).toHaveBeenCalledWith('cities/search/?q=Kyi');
    });

    test('handles search error', async () => {
      const error = new Error('Search failed');
      api.apiRequest.mockRejectedValueOnce(error);

      searchCities('Kyiv');
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(mockResultsContainer.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('displaySearchResults', () => {
    test('displays search results', () => {
      const results = [
        { id: 1, name: 'Kyiv', country: 'UA' },
        { id: 2, name: 'London', country: 'GB' },
      ];

      // Mock createElement to return element with innerHTML
      const mockItem = {
        className: '',
        innerHTML: '',
        addEventListener: jest.fn(),
      };
      global.document.createElement.mockReturnValue(mockItem);
      mockResultsContainer.innerHTML = '';
      mockResultsContainer.appendChild = jest.fn();

      displaySearchResults(results);

      // Function uses createElement and appendChild, not innerHTML directly
      expect(global.document.createElement).toHaveBeenCalled();
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
    test('selects city and dispatches event', () => {
      const city = { id: 1, name: 'Kyiv', country: 'UA' };
      const dispatchEventSpy = jest.spyOn(global.document, 'dispatchEvent');

      selectCity(city, false);

      expect(mockSearchInput.value).toBe('');
      expect(dispatchEventSpy).toHaveBeenCalled();
      const event = dispatchEventSpy.mock.calls[0][0];
      expect(event.detail.city).toEqual(city);
      expect(event.detail.cityId).toBe(1);
    });

    test('shows subscription modal when createSubscription is true', () => {
      const city = { id: 1, name: 'Kyiv', country: 'UA' };
      api.getAuthToken.mockReturnValueOnce('token');

      const modal = {
        classList: { remove: jest.fn() },
      };
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'subscription-modal') return modal;
        if (id === 'search-results') return mockResultsContainer;
        if (id === 'city-search') return mockSearchInput;
        return null;
      });

      selectCity(city, true);

      expect(modal.classList.remove).toHaveBeenCalledWith('hidden');
    });

    test('shows login prompt when not authenticated', () => {
      const city = { id: 1, name: 'Kyiv', country: 'UA' };
      api.getAuthToken.mockReturnValueOnce(null);
      global.alert = jest.fn();

      selectCity(city, true);

      expect(global.alert).toHaveBeenCalledWith('Please log in to subscribe to cities');
    });
  });

  describe('initSearch', () => {
    test('initializes search input listener', () => {
      initSearch();

      expect(mockSearchInput.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
    });

    test('handles missing search input gracefully', () => {
      global.document.getElementById.mockReturnValueOnce(null);

      expect(() => initSearch()).not.toThrow();
    });
  });
});

