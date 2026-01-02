/**
 * City search functionality
 */

import { apiRequest, handleApiError } from './api.js';

let searchTimeout = null;
const DEBOUNCE_DELAY = 300;

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
      const results = await apiRequest(`cities/search/?q=${encodeURIComponent(query)}`);
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
    item.className = 'p-3 hover:bg-dark-bg-primary cursor-pointer transition-colors';
    item.innerHTML = `
      <div class="font-medium text-dark-text-primary">${city.name}</div>
      <div class="text-sm text-dark-text-secondary">${city.country}</div>
    `;
    item.addEventListener('click', () => selectCity(city));
    resultsContainer.appendChild(item);
  });

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
 */
export function selectCity(city) {
  hideSearchResults();

  // Clear search input
  const searchInput = document.getElementById('city-search');
  if (searchInput) {
    searchInput.value = '';
  }

  // Dispatch custom event for city selection
  const event = new CustomEvent('citySelected', { detail: { city } });
  document.dispatchEvent(event);
}

/**
 * Initialize search functionality
 */
export function initSearch() {
  const searchInput = document.getElementById('city-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    searchCities(e.target.value);
  });

  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer && !resultsContainer.contains(e.target) && e.target !== searchInput) {
      hideSearchResults();
    }
  });
}

