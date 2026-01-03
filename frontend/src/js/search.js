/**
 * City search functionality
 */

import { apiRequest, handleApiError, getAuthToken } from './api.js';
import { createSubscription, showSubscriptionSettingsModal } from './subscriptions.js';
import { loadSubscribedCitiesWithWeather, renderSubscribedCitiesList } from './subscriptions.js';

let searchTimeout = null;
const DEBOUNCE_DELAY = 300;

/**
 * Helper function to escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Search cities with debounce
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
      const response = await apiRequest(`cities/search/?q=${encodeURIComponent(query)}`);
      // Handle paginated response (results) or direct array
      const results = response.results || response;

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
 */
export function displaySearchResults(results) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;

  if (!results || results.length === 0) {
    resultsContainer.innerHTML = '<div class="p-4 text-dark-text-secondary text-center">No cities found</div>';
    resultsContainer.classList.remove('hidden');
    return;
  }

  resultsContainer.innerHTML = '';

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
    // При кліку на результат автоматично створюємо підписку
    item.addEventListener('click', () => selectCity(city, true));
    resultsContainer.appendChild(item);
  });

  // Expose function globally for inline onclick handler
  window.selectCityAndSubscribe = (cityId, cityName, cityCountry) => {
    selectCity({ id: cityId, name: cityName, country: cityCountry }, true);
  };

  resultsContainer.classList.remove('hidden');
}

/**
 * Hide search results dropdown
 */
export function hideSearchResults() {
  const resultsContainer = document.getElementById('search-results');
  if (resultsContainer) {
    resultsContainer.classList.add('hidden');
  }
}

/**
 * Select city and update UI
 * Optionally create subscription if user is authenticated
 */
export function selectCity(city, createSubscription = false) {
  hideSearchResults();

  // Clear search input
  const searchInput = document.getElementById('city-search');
  if (searchInput) {
    searchInput.value = '';
  }

  // If user wants to create subscription
  if (createSubscription) {
    // Check if user is authenticated
    const token = getAuthToken();
    if (!token) {
      showNotification('Please log in to add cities', 'error');
      return;
    }

    // Try to show modal, if not available, create subscription directly
    const modal = document.getElementById('subscription-modal');
    if (modal) {
      showSubscriptionModal(city);
    } else {
      // Create subscription directly with defaults
      createSubscriptionFromSearch(city);
    }
  } else {
    // Dispatch custom event for city selection
    const event = new CustomEvent('citySelected', { detail: { city, cityId: city.id } });
    document.dispatchEvent(event);
  }
}

/**
 * Show subscription creation modal
 */
function showSubscriptionModal(city) {
  // Check if user is authenticated
  const token = getAuthToken();

  if (!token) {
    // Show login prompt
    alert('Please log in to subscribe to cities');
    return;
  }

  // Show modal for creating new subscription (no subscription object)
  showSubscriptionSettingsModal(null, city);
}



/**
 * Create subscription directly from search (fallback)
 */
async function createSubscriptionFromSearch(city) {
  try {
    // Pass city object (with or without id) - function will handle it
    await createSubscription(city, 6, 'current', 'email');

    // Reload subscriptions list to show in right panel
    const citiesData = await loadSubscribedCitiesWithWeather();
    renderSubscribedCitiesList(citiesData);

    showNotification(`Successfully added ${city.name}, ${city.country}`, 'success');

    // Select the newly subscribed city
    const event = new CustomEvent('citySelected', { detail: { city, cityId: city.id } });
    document.dispatchEvent(event);
  } catch (error) {
    console.error('Failed to create subscription:', error);
    const errorMsg = error.response?.city_id?.[0] || error.message || 'Failed to create subscription';
    showNotification(errorMsg, 'error');
  }
}


/**
 * Initialize search functionality
 */
let searchInitialized = false;
let clickHandler = null;

export function initSearch() {
  const searchInput = document.getElementById('city-search');
  if (!searchInput) {
    console.warn('Search input not found');
    return;
  }

  // Remove existing event listeners if already initialized
  if (searchInitialized && clickHandler) {
    document.removeEventListener('click', clickHandler);
  }

  // Add input event listener (only once per element)
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

  // Hide results when clicking outside
  clickHandler = (e) => {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer && !resultsContainer.contains(e.target) && e.target !== searchInput) {
      hideSearchResults();
    }
  };

  document.addEventListener('click', clickHandler);
  searchInitialized = true;
}

