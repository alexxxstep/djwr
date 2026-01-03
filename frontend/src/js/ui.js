/**
 * UI interactions and navigation
 */

import { getWeatherIcon, formatTemperature, formatDate, formatTime } from './icons.js';

/**
 * Initialize sidebar navigation
 */
export function initSidebar() {
  const navItems = document.querySelectorAll('.nav-item');
  const currentPath = window.location.pathname;

  navItems.forEach((item) => {
    const navType = item.getAttribute('data-nav');
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
 */
export function handleActiveNav(navType) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    item.classList.remove('active');
    if (item.getAttribute('data-nav') === navType) {
      item.classList.add('active');
    }
  });
}

/**
 * Initialize period navigation
 */
export function initPeriodNavigation() {
  const periodButtons = document.querySelectorAll('.period-btn');

  periodButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const period = button.getAttribute('data-period');
      handlePeriodSelect(period);
    });
  });
}

/**
 * Handle period selection
 */
export function handlePeriodSelect(period) {
  // Update active state
  const periodButtons = document.querySelectorAll('.period-btn');
  periodButtons.forEach((btn) => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-period') === period) {
      btn.classList.add('active');
    }
  });

  // Dispatch event
  const event = new CustomEvent('periodSelected', { detail: { period } });
  document.dispatchEvent(event);
}

/**
 * Handle city selection
 */
export function handleCitySelect(cityId) {
  // Dispatch event for city selection
  const event = new CustomEvent('citySelected', { detail: { cityId } });
  document.dispatchEvent(event);
}

/**
 * Update selected city detail card
 */
export function updateSelectedCityDetail(cityId, weatherData) {
  const container = document.getElementById('selected-city-detail');
  if (!container || !weatherData) return;

  const template = document.getElementById('city-detail-template');
  if (!template) return;

  const clone = template.content.cloneNode(true);

  // Update date
  const dateEl = clone.getElementById('detail-date');
  if (dateEl && weatherData.fetched_at) {
    dateEl.textContent = formatDate(weatherData.fetched_at);
  }

  // Update city name
  const cityEl = clone.getElementById('detail-city');
  if (cityEl && weatherData.city) {
    cityEl.textContent = weatherData.city.name || weatherData.city;
  }

  // Update description
  const descEl = clone.getElementById('detail-description');
  if (descEl && weatherData.description) {
    descEl.textContent = weatherData.description;
  }

  // Update temperature
  const tempEl = clone.getElementById('detail-temp');
  if (tempEl && weatherData.temperature !== undefined) {
    tempEl.textContent = formatTemperature(weatherData.temperature);
  }

  // Update high/low
  const highEl = clone.getElementById('detail-high');
  const lowEl = clone.getElementById('detail-low');
  if (highEl && weatherData.temp_max !== undefined) {
    highEl.textContent = `H ${formatTemperature(weatherData.temp_max)}`;
  }
  if (lowEl && weatherData.temp_min !== undefined) {
    lowEl.textContent = `L ${formatTemperature(weatherData.temp_min)}`;
  }

  // Update icon
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
 * Note: Time is not updated here - it's updated by updateCitiesTime() every minute
 */
export function updateCityListItem(cityId, weatherData) {
  const listItem = document.querySelector(`.city-list-item[data-city-id="${cityId}"]`);
  if (!listItem || !weatherData) return;

  // Don't update time here - it's updated by updateCitiesTime() every minute
  // Time should show current local time, not fetched_at time

  const iconEl = listItem.querySelector('#list-item-icon');
  if (iconEl && weatherData.description) {
    const icon = getWeatherIcon(weatherData.description, 'small');
    iconEl.innerHTML = '';
    iconEl.appendChild(icon);
  }

  const tempEl = listItem.querySelector('#list-item-temp');
  if (tempEl && weatherData.temperature !== undefined) {
    tempEl.textContent = formatTemperature(weatherData.temperature);
  }
}

/**
 * Scroll hourly forecast horizontally
 */
export function scrollHourlyForecast(direction = 'right') {
  const container = document.getElementById('hourly-forecast-container');
  if (!container) return;

  const scrollAmount = 200;
  const currentScroll = container.scrollLeft;
  const newScroll = direction === 'right'
    ? currentScroll + scrollAmount
    : currentScroll - scrollAmount;

  container.scrollTo({
    left: newScroll,
    behavior: 'smooth',
  });
}

/**
 * Toggle air conditions details
 */
export function toggleAirConditions() {
  const seeMoreBtn = document.getElementById('see-more-btn');
  if (!seeMoreBtn) return;

  seeMoreBtn.addEventListener('click', () => {
    // Toggle expanded view (can be implemented later)
    console.log('See more clicked');
  });
}

/**
 * Initialize city navigation
 */
export function initCityNavigation() {
  // City selection is handled in main.js with debouncing
  // No need for duplicate handler here
}

