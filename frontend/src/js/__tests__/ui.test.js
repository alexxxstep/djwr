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

// Mock modules
jest.mock('../icons.js', () => ({
  getWeatherIcon: jest.fn(),
  formatTemperature: jest.fn(),
  formatTime: jest.fn(),
  formatDate: jest.fn(),
}));

// Mock DOM
const mockNavItems = [];
const mockPeriodButtons = [];

describe('UI Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        classList: { add: jest.fn() },
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
        classList: { add: jest.fn() },
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
        },
      };
      const navItem2 = {
        getAttribute: jest.fn(() => 'cities'),
        classList: {
          remove: jest.fn(),
          add: jest.fn(),
        },
      };
      mockNavItems.length = 0;
      mockNavItems.push(navItem1, navItem2);

      handleActiveNav('cities');

      expect(navItem1.classList.remove).toHaveBeenCalledWith('active');
      expect(navItem2.classList.add).toHaveBeenCalledWith('active');
    });
  });

  describe('initPeriodNavigation', () => {
    test('initializes period navigation buttons', () => {
      const periodBtn = {
        getAttribute: jest.fn(() => 'current'),
        addEventListener: jest.fn(),
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
        },
      };
      const periodBtn2 = {
        getAttribute: jest.fn(() => 'today'),
        classList: {
          remove: jest.fn(),
          add: jest.fn(),
        },
      };
      mockPeriodButtons.length = 0;
      mockPeriodButtons.push(periodBtn1, periodBtn2);

      handlePeriodSelect('today');

      expect(periodBtn1.classList.remove).toHaveBeenCalledWith('active');
      expect(periodBtn2.classList.add).toHaveBeenCalledWith('active');
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
      const container = { innerHTML: '', appendChild: jest.fn() };
      const template = {
        content: {
          cloneNode: jest.fn(() => ({
            getElementById: jest.fn(() => ({ textContent: '', innerHTML: '', appendChild: jest.fn() })),
          })),
        },
      };

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'selected-city-detail') return container;
        if (id === 'city-detail-template') return template;
        return null;
      });

      icons.formatDate.mockReturnValue('Jan 1, 2024');
      icons.formatTemperature.mockReturnValue('15°');
      icons.getWeatherIcon.mockReturnValue(document.createElement('div'));

      const weatherData = {
        temperature: 15,
        description: 'sunny',
        city: { name: 'Kyiv' },
        fetched_at: '2024-01-01T12:00:00Z',
      };

      updateSelectedCityDetail(1, weatherData);

      expect(container.innerHTML).toBe('');
      expect(container.appendChild).toHaveBeenCalled();
    });

    test('handles missing container gracefully', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => updateSelectedCityDetail(1, {})).not.toThrow();
    });
  });

  describe('updateCityListItem', () => {
    test('updates city list item', () => {
      const timeEl = { textContent: '' };
      const iconEl = { innerHTML: '', appendChild: jest.fn() };
      const tempEl = { textContent: '' };
      const listItem = {
        querySelector: jest.fn((selector) => {
          if (selector === '#list-item-time') return timeEl;
          if (selector === '#list-item-icon') return iconEl;
          if (selector === '#list-item-temp') return tempEl;
          return null;
        }),
      };

      global.document.querySelector.mockReturnValue(listItem);
      icons.formatTime.mockReturnValue('12:00 PM');
      icons.formatTemperature.mockReturnValue('15°');
      icons.getWeatherIcon.mockReturnValue(document.createElement('div'));

      const weatherData = {
        temperature: 15,
        description: 'sunny',
        fetched_at: '2024-01-01T12:00:00Z',
      };

      updateCityListItem(1, weatherData);

      expect(listItem.querySelector).toHaveBeenCalled();
      expect(icons.formatTime).toHaveBeenCalledWith('2024-01-01T12:00:00Z');
    });
  });

  describe('scrollHourlyForecast', () => {
    test('scrolls hourly forecast container', () => {
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
  });

  describe('toggleAirConditions', () => {
    test('sets up see more button handler', () => {
      const button = {
        addEventListener: jest.fn(),
      };

      global.document.getElementById.mockReturnValue(button);

      toggleAirConditions();

      expect(button.addEventListener).toHaveBeenCalled();
    });
  });

  describe('initCityNavigation', () => {
    test('sets up city selection event listener', () => {
      initCityNavigation();

      expect(global.document.addEventListener).toHaveBeenCalledWith(
        'citySelected',
        expect.any(Function)
      );
    });
  });
});

