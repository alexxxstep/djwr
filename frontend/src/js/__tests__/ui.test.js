/**
 * Tests for UI interactions module
 */

import {
  initSidebar,
  handleActiveNav,
  initPeriodNavigation,
  handlePeriodSelect,
  handleCitySelect,
  updateSelectedCityDetail,
  updateCityListItem,
  scrollHourlyForecast,
  toggleAirConditions,
  initCityNavigation,
} from '../ui.js';
import * as icons from '../icons.js';
import * as weather from '../weather.js';

// Mock modules
jest.mock('../icons.js', () => ({
  getWeatherIcon: jest.fn(() => ({
    tagName: 'DIV',
    innerHTML: '<svg></svg>',
    querySelector: jest.fn(),
  })),
  formatTemperature: jest.fn((temp) => temp != null ? `${temp}°` : '--'),
  formatTime: jest.fn(() => '12:00 PM'),
  formatDate: jest.fn(() => 'Monday 12:00 PM'),
}));

jest.mock('../weather.js', () => ({
  getFirstWeatherItem: jest.fn((response) => {
    if (!response?.data || response.data.length === 0) return null;
    return response.data[0];
  }),
}));

// Mock DOM elements
const mockNavItems = [];
const mockPeriodButtons = [];

describe('UI Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Clear mock arrays
    mockNavItems.length = 0;
    mockPeriodButtons.length = 0;

    global.window.location = { pathname: '/' };
    global.document.querySelectorAll = jest.fn((selector) => {
      if (selector === '.nav-item') return mockNavItems;
      if (selector === '.period-btn') return mockPeriodButtons;
      return [];
    });
    global.document.querySelector = jest.fn(() => null);
    global.document.getElementById = jest.fn(() => null);
    global.document.addEventListener = jest.fn();
    global.document.dispatchEvent = jest.fn();
  });

  describe('initSidebar', () => {
    test('initializes sidebar navigation', () => {
      const navItem = {
        getAttribute: jest.fn(() => 'weather'),
        classList: { add: jest.fn(), toggle: jest.fn() },
        addEventListener: jest.fn(),
      };
      mockNavItems.push(navItem);

      initSidebar();

      expect(navItem.addEventListener).toHaveBeenCalled();
    });

    test('sets active state for current path', () => {
      global.window.location.pathname = '/';
      const navItem = {
        getAttribute: jest.fn(() => 'weather'),
        classList: { add: jest.fn(), toggle: jest.fn() },
        addEventListener: jest.fn(),
      };
      mockNavItems.push(navItem);

      initSidebar();

      expect(navItem.classList.add).toHaveBeenCalledWith('active');
    });
  });

  describe('handleActiveNav', () => {
    test('updates active navigation state', () => {
      const navItem1 = {
        getAttribute: jest.fn(() => 'weather'),
        classList: {
          remove: jest.fn(),
          add: jest.fn(),
          toggle: jest.fn(),
        },
      };
      const navItem2 = {
        getAttribute: jest.fn(() => 'cities'),
        classList: {
          remove: jest.fn(),
          add: jest.fn(),
          toggle: jest.fn(),
        },
      };
      mockNavItems.length = 0;
      mockNavItems.push(navItem1, navItem2);

      handleActiveNav('cities');

      expect(navItem1.classList.toggle).toHaveBeenCalledWith('active', false);
      expect(navItem2.classList.toggle).toHaveBeenCalledWith('active', true);
    });
  });

  describe('initPeriodNavigation', () => {
    test('initializes period navigation buttons', () => {
      const periodBtn = {
        getAttribute: jest.fn(() => 'current'),
        addEventListener: jest.fn(),
        classList: { toggle: jest.fn() },
      };
      mockPeriodButtons.push(periodBtn);

      initPeriodNavigation();

      expect(periodBtn.addEventListener).toHaveBeenCalled();
    });
  });

  describe('handlePeriodSelect', () => {
    test('updates active period and dispatches event', () => {
      const periodBtn1 = {
        getAttribute: jest.fn(() => 'current'),
        classList: {
          remove: jest.fn(),
          add: jest.fn(),
          toggle: jest.fn(),
        },
      };
      const periodBtn2 = {
        getAttribute: jest.fn(() => 'today'),
        classList: {
          remove: jest.fn(),
          add: jest.fn(),
          toggle: jest.fn(),
        },
      };
      mockPeriodButtons.length = 0;
      mockPeriodButtons.push(periodBtn1, periodBtn2);

      handlePeriodSelect('today');

      expect(periodBtn1.classList.toggle).toHaveBeenCalledWith('active', false);
      expect(periodBtn2.classList.toggle).toHaveBeenCalledWith('active', true);
      expect(global.document.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('handleCitySelect', () => {
    test('dispatches citySelected event', () => {
      handleCitySelect(1);

      expect(global.document.dispatchEvent).toHaveBeenCalled();
      const event = global.document.dispatchEvent.mock.calls[0][0];
      expect(event.detail.cityId).toBe(1);
    });
  });

  describe('updateSelectedCityDetail', () => {
    test('updates selected city detail card', () => {
      const mockElement = {
        textContent: '',
        innerHTML: '',
        appendChild: jest.fn(),
      };

      const mockClone = {
        getElementById: jest.fn(() => mockElement),
      };

      const mockContainer = {
        innerHTML: '',
        appendChild: jest.fn(),
      };

      const mockTemplate = {
        content: {
          cloneNode: jest.fn(() => mockClone),
        },
      };

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'selected-city-detail') return mockContainer;
        if (id === 'city-detail-template') return mockTemplate;
        return null;
      });

      weather.getFirstWeatherItem.mockReturnValue({
        temp: 15,
        description: 'sunny',
        temp_max: 20,
        temp_min: 10,
      });

      const weatherResponse = {
        city: { id: 1, name: 'Kyiv' },
        period: 'current',
        meta: { fetched_at: '2024-01-01T12:00:00Z' },
        data: [{ temp: 15, description: 'sunny' }],
      };

      updateSelectedCityDetail(1, weatherResponse);

      expect(mockContainer.innerHTML).toBe('');
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    test('handles missing container gracefully', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => updateSelectedCityDetail(1, { data: [{ temp: 15 }] })).not.toThrow();
    });

    test('handles missing weather data', () => {
      const mockContainer = { innerHTML: '', appendChild: jest.fn() };
      const mockTemplate = { content: { cloneNode: jest.fn() } };

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'selected-city-detail') return mockContainer;
        if (id === 'city-detail-template') return mockTemplate;
        return null;
      });

      weather.getFirstWeatherItem.mockReturnValue(null);

      updateSelectedCityDetail(1, { data: [] });

      expect(mockContainer.appendChild).not.toHaveBeenCalled();
    });
  });

  describe('updateCityListItem', () => {
    test('updates city list item elements', () => {
      const mockIconEl = {
        innerHTML: '',
        appendChild: jest.fn(),
      };
      const mockTempEl = {
        textContent: '',
      };

      const listItem = {
        querySelector: jest.fn((selector) => {
          if (selector === '#list-item-icon') return mockIconEl;
          if (selector === '#list-item-temp') return mockTempEl;
          return null;
        }),
      };

      global.document.querySelector.mockReturnValue(listItem);

      weather.getFirstWeatherItem.mockReturnValue({
        temp: 15,
        description: 'sunny',
      });

      const weatherResponse = {
        city: { id: 1 },
        data: [{ temp: 15, description: 'sunny' }],
      };

      updateCityListItem(1, weatherResponse);

      expect(listItem.querySelector).toHaveBeenCalled();
      // formatTemperature returns '15°' for temp 15
      expect(icons.formatTemperature).toHaveBeenCalledWith(15);
    });

    test('handles missing list item', () => {
      global.document.querySelector.mockReturnValue(null);

      expect(() => updateCityListItem(1, { data: [] })).not.toThrow();
    });
  });

  describe('scrollHourlyForecast', () => {
    test('scrolls hourly forecast container right', () => {
      const container = {
        scrollLeft: 0,
        scrollTo: jest.fn(),
      };

      global.document.getElementById.mockReturnValue(container);

      scrollHourlyForecast('right');

      expect(container.scrollTo).toHaveBeenCalledWith({
        left: 200,
        behavior: 'smooth',
      });
    });

    test('scrolls left when direction is left', () => {
      const container = {
        scrollLeft: 200,
        scrollTo: jest.fn(),
      };

      global.document.getElementById.mockReturnValue(container);

      scrollHourlyForecast('left');

      expect(container.scrollTo).toHaveBeenCalledWith({
        left: 0,
        behavior: 'smooth',
      });
    });

    test('handles missing container', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => scrollHourlyForecast()).not.toThrow();
    });
  });

  describe('toggleAirConditions', () => {
    test('sets up see more button handler', () => {
      const button = {
        addEventListener: jest.fn(),
      };

      global.document.getElementById.mockReturnValue(button);

      toggleAirConditions();

      expect(button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('handles missing button', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => toggleAirConditions()).not.toThrow();
    });
  });

  describe('initCityNavigation', () => {
    test('exists and does not throw', () => {
      expect(() => initCityNavigation()).not.toThrow();
    });
  });
});
