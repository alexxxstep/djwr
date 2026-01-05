/**
 * UI interactions and navigation
 * Refactored version - clean implementation
 */

import { getWeatherIcon, formatTemperature, formatDate } from './icons.js';
import { getFirstWeatherItem } from './weather.js';

/**
 * Initialize sidebar navigation
 */
export function initSidebar() {
  const navItems = document.querySelectorAll('.nav-item');
  const currentPath = window.location.pathname;

  navItems.forEach((item) => {
    const navType = item.getAttribute('data-nav');

    // Set active state based on current path
    if (navType === 'weather' && currentPath === '/') {
      item.classList.add('active');
    } else if (currentPath.includes(`/${navType}/`)) {
      item.classList.add('active');
    }

    item.addEventListener('click', (e) => {
      e.preventDefault();
      handleActiveNav(navType);
    });
  });
}

/**
 * Handle active navigation state
 * @param {string} navType - Navigation type
 */
export function handleActiveNav(navType) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-nav') === navType);
  });
}

/**
 * Initialize period navigation
 */
export function initPeriodNavigation() {
  document.querySelectorAll('.period-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const period = button.getAttribute('data-period');
      handlePeriodSelect(period);
    });
  });
}

/**
 * Handle period selection
 * @param {string} period - Selected period
 */
export function handlePeriodSelect(period) {
  // Update active state
  document.querySelectorAll('.period-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-period') === period);
  });

  // Dispatch event
  document.dispatchEvent(new CustomEvent('periodSelected', { detail: { period } }));
}

/**
 * Handle city selection
 * @param {number} cityId - City ID
 */
export function handleCitySelect(cityId) {
  document.dispatchEvent(new CustomEvent('citySelected', { detail: { cityId } }));
}

/**
 * Update selected city detail card
 * @param {number} cityId - City ID
 * @param {Object} response - Weather API response
 */
export function updateSelectedCityDetail(cityId, response) {
  const container = document.getElementById('selected-city-detail');
  if (!container || !response) return;

  const template = document.getElementById('city-detail-template');
  if (!template) return;

  const weatherData = getFirstWeatherItem(response);
  if (!weatherData) return;

  const clone = template.content.cloneNode(true);

  // Date
  setElementText(clone, 'detail-date', response.meta?.fetched_at ? formatDate(response.meta.fetched_at) : '');

  // City name
  setElementText(clone, 'detail-city', response.city?.name || '');

  // Description
  setElementText(clone, 'detail-description', weatherData.description || '');

  // Temperature
  setElementText(clone, 'detail-temp', weatherData.temp !== undefined ? formatTemperature(weatherData.temp) : '--');

  // High/Low
  if (weatherData.temp_max !== undefined) {
    setElementText(clone, 'detail-high', `H ${formatTemperature(weatherData.temp_max)}`);
  }
  if (weatherData.temp_min !== undefined) {
    setElementText(clone, 'detail-low', `L ${formatTemperature(weatherData.temp_min)}`);
  }

  // Icon
  const iconEl = clone.getElementById('detail-icon-large');
  if (iconEl && weatherData.description) {
    const icon = getWeatherIcon(weatherData.description, 'large');
    iconEl.innerHTML = '';
    iconEl.appendChild(icon);
  }

  container.innerHTML = '';
  container.appendChild(clone);
}

/**
 * Update city list item
 * @param {number} cityId - City ID
 * @param {Object} response - Weather API response
 */
export function updateCityListItem(cityId, response) {
  const listItem = document.querySelector(`.city-list-item[data-city-id="${cityId}"]`);
  if (!listItem || !response) return;

  const weatherData = getFirstWeatherItem(response);
  if (!weatherData) return;

  // Icon
  const iconEl = listItem.querySelector('#list-item-icon');
  if (iconEl && weatherData.description) {
    const icon = getWeatherIcon(weatherData.description, 'small');
    iconEl.innerHTML = '';
    iconEl.appendChild(icon);
  }

  // Temperature
  const tempEl = listItem.querySelector('#list-item-temp');
  if (tempEl && weatherData.temp !== undefined) {
    tempEl.textContent = formatTemperature(weatherData.temp);
  }
}

/**
 * Set element text helper
 * @param {DocumentFragment} fragment - Template fragment
 * @param {string} id - Element ID
 * @param {string} text - Text content
 */
function setElementText(fragment, id, text) {
  const el = fragment.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Scroll hourly forecast
 * @param {string} direction - 'left' or 'right'
 */
export function scrollHourlyForecast(direction = 'right') {
  const container = document.getElementById('hourly-forecast-container');
  if (!container) return;

  const scrollAmount = 200;
  container.scrollTo({
    left: container.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount),
    behavior: 'smooth',
  });
}

/**
 * Toggle air conditions details
 */
export function toggleAirConditions() {
  const seeMoreBtn = document.getElementById('see-more-btn');
  if (seeMoreBtn) {
    seeMoreBtn.addEventListener('click', () => {
    });
  }
}

/**
 * Initialize city navigation
 */
export function initCityNavigation() {
  // City selection handled in main.js
}

// Store event handlers for drag-to-scroll to allow cleanup
let dragScrollHandlers = {
  container: null,
  handlers: null,
};

/**
 * Initialize drag-to-scroll for hourly forecast container
 */
export function initDragToScroll() {
  const container = document.getElementById('hourly-forecast-container');
  if (!container) return;

  // Remove existing handlers if container changed or already initialized
  if (dragScrollHandlers.container && dragScrollHandlers.container === container && dragScrollHandlers.handlers) {
    // Already initialized for this container, skip
    return;
  }

  // Clean up previous handlers if container changed
  if (dragScrollHandlers.container && dragScrollHandlers.container !== container && dragScrollHandlers.handlers) {
    removeDragScrollHandlers(dragScrollHandlers.container, dragScrollHandlers.handlers);
  }

  let isDown = false;
  let startX;
  let scrollLeft;

  // Create handler functions
  const handleMouseDown = (e) => {
    isDown = true;
    container.style.cursor = 'grabbing';
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
    e.preventDefault();
  };

  const handleMouseLeave = () => {
    isDown = false;
    container.style.cursor = 'grab';
  };

  const handleMouseUp = () => {
    isDown = false;
    container.style.cursor = 'grab';
  };

  const handleMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    container.scrollLeft = scrollLeft - walk;
  };

  const handleSelectStart = (e) => {
    if (isDown) {
      e.preventDefault();
    }
  };

  // Store handlers
  const handlers = {
    mousedown: handleMouseDown,
    mouseleave: handleMouseLeave,
    mouseup: handleMouseUp,
    mousemove: handleMouseMove,
    selectstart: handleSelectStart,
  };

  // Add grab cursor on hover
  container.style.cursor = 'grab';
  container.style.userSelect = 'none';

  // Hide scrollbar but keep functionality
  container.style.scrollbarWidth = 'none'; // Firefox
  container.style.msOverflowStyle = 'none'; // IE/Edge

  // Add event listeners
  container.addEventListener('mousedown', handlers.mousedown);
  container.addEventListener('mouseleave', handlers.mouseleave);
  container.addEventListener('mouseup', handlers.mouseup);
  container.addEventListener('mousemove', handlers.mousemove);
  container.addEventListener('selectstart', handlers.selectstart);

  // Store for cleanup
  dragScrollHandlers.container = container;
  dragScrollHandlers.handlers = handlers;
}

/**
 * Remove drag-to-scroll event handlers
 */
function removeDragScrollHandlers(container, handlers) {
  if (!container || !handlers) return;
  container.removeEventListener('mousedown', handlers.mousedown);
  container.removeEventListener('mouseleave', handlers.mouseleave);
  container.removeEventListener('mouseup', handlers.mouseup);
  container.removeEventListener('mousemove', handlers.mousemove);
  container.removeEventListener('selectstart', handlers.selectstart);
}

/**
 * Initialize vertical drag-to-scroll for cities list container
 */
export function initCitiesListDragScroll() {
  const container = document.getElementById('cities-panel-scroll');
  if (!container) return;

  // Prevent duplicate initialization
  if (container.dataset.dragScrollInitialized === 'true') return;
  container.dataset.dragScrollInitialized = 'true';

  let isDown = false;
  let startY;
  let scrollTop;

  // Add grab cursor on hover
  container.style.cursor = 'grab';
  container.style.userSelect = 'none';

  // Hide scrollbar but keep functionality
  container.style.scrollbarWidth = 'none'; // Firefox
  container.style.msOverflowStyle = 'none'; // IE/Edge

  container.addEventListener('mousedown', (e) => {
    isDown = true;
    container.style.cursor = 'grabbing';
    startY = e.pageY - container.offsetTop;
    scrollTop = container.scrollTop;
    e.preventDefault();
  });

  container.addEventListener('mouseleave', () => {
    isDown = false;
    container.style.cursor = 'grab';
  });

  container.addEventListener('mouseup', () => {
    isDown = false;
    container.style.cursor = 'grab';
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const y = e.pageY - container.offsetTop;
    const walk = (y - startY) * 1.5; // Scroll speed multiplier
    container.scrollTop = scrollTop - walk;
  });

  // Prevent text selection while dragging
  container.addEventListener('selectstart', (e) => {
    if (isDown) {
      e.preventDefault();
    }
  });
}
