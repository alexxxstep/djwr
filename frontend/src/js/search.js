/**
 * City search functionality
 * Refactored version - clean implementation
 */

import { apiGet, handleApiError, getAuthToken } from './api.js';
import { API_ENDPOINTS } from './config.js';
import {
  createSubscription,
  showSubscriptionSettingsModal,
  loadSubscribedCitiesWithWeather,
  renderSubscribedCitiesList,
} from './subscriptions.js';

const DEBOUNCE_DELAY = 300;
let searchTimeout = null;
let searchInitialized = false;
let clickHandler = null;

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Search cities with debounce
 * @param {string} query - Search query
 * @param {Function} callback - Optional callback for results
 */
export function searchCities(query, callback) {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  if (!query || query.length < 2) {
    hideSearchResults();
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const response = await apiGet(`${API_ENDPOINTS.citySearch}?q=${encodeURIComponent(query)}`);
      const results = response.results || response || [];

      if (callback) {
        callback(results);
      } else {
        displaySearchResults(results);
      }
    } catch (error) {
      handleApiError(error);
      hideSearchResults();
    }
  }, DEBOUNCE_DELAY);
}

/**
 * Display search results in dropdown
 * @param {Array} results - Search results
 */
export function displaySearchResults(results) {
  const container = document.getElementById('search-results');
  if (!container) return;

  if (!results || results.length === 0) {
    container.innerHTML = '<div class="p-4 text-dark-text-secondary text-center">No cities found</div>';
    container.classList.remove('hidden');
    return;
  }

  container.innerHTML = '';

  results.forEach((city) => {
    const item = document.createElement('div');
    item.className = 'p-3 hover:bg-dark-bg-primary cursor-pointer transition-colors border-b border-dark-bg-secondary last:border-b-0';
    item.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <div class="font-medium text-dark-text-primary">${escapeHtml(city.name)}</div>
          <div class="text-sm text-dark-text-secondary">${escapeHtml(city.country)}</div>
        </div>
        <svg class="w-5 h-5 text-dark-text-secondary ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    `;
    item.addEventListener('click', () => selectCity(city, true));
    container.appendChild(item);
  });

  container.classList.remove('hidden');
}

/**
 * Hide search results dropdown
 */
export function hideSearchResults() {
  const container = document.getElementById('search-results');
  if (container) {
    container.classList.add('hidden');
  }
}

/**
 * Select city from search results
 * @param {Object} city - City object
 * @param {boolean} shouldSubscribe - Whether to create subscription
 */
export function selectCity(city, shouldSubscribe = false) {
  hideSearchResults();

  // Clear search input
  const searchInput = document.getElementById('city-search');
  if (searchInput) {
    searchInput.value = '';
  }

  if (shouldSubscribe) {
    const token = getAuthToken();
    if (!token) {
      showNotification('Please log in to add cities', 'error');
      return;
    }

    const modal = document.getElementById('subscription-modal');
    if (modal) {
      showSubscriptionSettingsModal(null, city);
    } else {
      createSubscriptionDirect(city);
    }
  } else {
    document.dispatchEvent(new CustomEvent('citySelected', {
      detail: { city, cityId: city.id }
    }));
  }
}

/**
 * Create subscription directly (without modal)
 * @param {Object} city - City object
 */
async function createSubscriptionDirect(city) {
  try {
    await createSubscription(city, 6, 'current', 'email', false);

    const citiesData = await loadSubscribedCitiesWithWeather();
    renderSubscribedCitiesList(citiesData);

    showNotification(`Successfully added ${city.name}, ${city.country}`, 'success');

    document.dispatchEvent(new CustomEvent('citySelected', {
      detail: { city, cityId: city.id }
    }));
  } catch (error) {
    showNotification(error.message || 'Failed to add city', 'error');
  }
}

/**
 * Initialize search functionality
 */
export function initSearch() {
  const searchInput = document.getElementById('city-search');
  if (!searchInput) return;

  // Remove existing click handler
  if (searchInitialized && clickHandler) {
    document.removeEventListener('click', clickHandler);
  }

  // Add input listener (only once)
  if (!searchInput.hasAttribute('data-search-initialized')) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        searchCities(query);
      } else {
        hideSearchResults();
      }
    });
    searchInput.setAttribute('data-search-initialized', 'true');
  }

  // Click outside to close
  clickHandler = (e) => {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer && !resultsContainer.contains(e.target) && e.target !== searchInput) {
      hideSearchResults();
    }
  };

  document.addEventListener('click', clickHandler);
  searchInitialized = true;
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  };

  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${colors[type]} text-white`;
  notification.textContent = message;

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}
