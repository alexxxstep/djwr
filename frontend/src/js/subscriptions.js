/**
 * Subscriptions management
 * Refactored version - clean, uses new API format
 */

import { apiGet, apiPost, apiPatch, apiDelete, handleApiError } from './api.js';
import { API_ENDPOINTS, VALID_PERIODS } from './config.js';
import cache, { Cache } from './cache.js';
import { fetchCurrentWeather, getFirstWeatherItem } from './weather.js';
import { getWeatherIcon, formatTemperature, formatTime } from './icons.js';
import { initCitiesListDragScroll } from './ui.js';

// State
let currentSelectedCityId = null;
let isSelectingCity = false;
let timeUpdateInterval = null;

/**
 * Get user subscriptions
 * @param {boolean} useCache - Whether to use cache
 * @returns {Promise<Array>} Array of subscription objects
 */
export async function getUserSubscriptions(useCache = true) {
  const cacheKey = Cache.subscriptionsKey();

  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await apiGet(API_ENDPOINTS.subscriptions);
    const subscriptions = response.results || (Array.isArray(response) ? response : []);

    // Cache for 1 minute
    cache.set(cacheKey, subscriptions, 60);

    return subscriptions;
  } catch (error) {
    if (error.status === 401) {
      return [];
    }
    handleApiError(error);
    return [];
  }
}

/**
 * Load subscribed cities with current weather
 * @returns {Promise<Array>} Array of { subscription, city, weather } objects
 */
export async function loadSubscribedCitiesWithWeather() {
  try {
    const subscriptions = await getUserSubscriptions();

    if (!subscriptions || subscriptions.length === 0) {
      return [];
    }

    // Fetch weather for all cities in parallel
    const citiesData = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const weatherResponse = await fetchCurrentWeather(subscription.city.id);
          return {
            subscription,
            city: subscription.city,
            weather: getFirstWeatherItem(weatherResponse),
            timezone_offset: weatherResponse?.timezone_offset || 0,
          };
        } catch (error) {
          console.error(`Failed to load weather for city ${subscription.city.id}:`, error);
          return {
            subscription,
            city: subscription.city,
            weather: null,
            timezone_offset: 0,
          };
        }
      })
    );

    return citiesData;
  } catch (error) {
    handleApiError(error);
    return [];
  }
}

/**
 * Render subscribed cities list
 * @param {Array} citiesData - Array of { subscription, city, weather } objects
 */
export function renderSubscribedCitiesList(citiesData) {
  const listContainer = document.getElementById('subscribed-cities-list');
  if (!listContainer) return;

  const countEl = document.getElementById('cities-count');
  if (countEl) {
    countEl.textContent = citiesData.length;
  }

  if (!citiesData || citiesData.length === 0) {
    listContainer.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">No subscribed cities</div>';
    return;
  }

  const template = document.getElementById('city-list-item-template');
  if (!template) return;

  listContainer.innerHTML = '';

  citiesData.forEach((item) => {
    const clone = template.content.cloneNode(true);
    const listItem = clone.querySelector('.city-list-item');

    if (listItem) {
      listItem.setAttribute('data-city-id', item.city.id);

      if (item.city.id === currentSelectedCityId) {
        listItem.classList.add('active');
      }

      // Click handler
      listItem.addEventListener('click', () => {
        selectCityFromList(item.city.id);
      });

      // Store city data for time updates (include timezone_offset from weather response)
      listItem.setAttribute('data-city', JSON.stringify({
        country: item.city.country,
        name: item.city.name,
        latitude: item.city.latitude,
        longitude: item.city.longitude,
        timezone_offset: item.timezone_offset || 0,
      }));
    }

    // City name with country code
    const cityEl = clone.getElementById('list-item-city');
    if (cityEl) {
      const cityName = item.city.name;
      const countryCode = item.city.country || '';
      cityEl.textContent = countryCode ? `${cityName} (${countryCode})` : cityName;
      if (!item.subscription.is_active) {
        cityEl.classList.add('text-dark-text-secondary', 'opacity-60');
      }
    }

    // Local time (use timezone_offset from API response)
    const timeEl = clone.getElementById('list-item-time');
    if (timeEl) {
      const timezoneOffset = item.timezone_offset || 0;
      // Use current UTC time and apply city's timezone offset
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      timeEl.textContent = formatTime(now, timezoneOffset);
    }

    // Weather icon
    const iconEl = clone.getElementById('list-item-icon');
    if (iconEl && item.weather?.description) {
      const icon = getWeatherIcon(item.weather.description, 'small');
      iconEl.innerHTML = '';
      iconEl.appendChild(icon);
    }

    // Temperature
    const tempEl = clone.getElementById('list-item-temp');
    if (tempEl) {
      tempEl.textContent = item.weather?.temp !== undefined
        ? formatTemperature(item.weather.temp)
        : '--';
    }

    // Settings button
    const settingsBtn = clone.querySelector('.settings-btn');
    if (settingsBtn && item.subscription?.id) {
      settingsBtn.setAttribute('data-subscription-id', item.subscription.id);
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSubscriptionSettingsModal(item.subscription, item.city);
      });
    }

    if (listItem && item.subscription?.id) {
      listItem.setAttribute('data-subscription-id', item.subscription.id);
    }

    listContainer.appendChild(clone);
  });

  // Initialize drag-to-scroll after rendering cities list
  setTimeout(() => {
    initCitiesListDragScroll();
  }, 50);
}

/**
 * Select city from list
 * @param {number} cityId - City ID to select
 */
export async function selectCityFromList(cityId) {
  if (isSelectingCity || currentSelectedCityId === cityId) {
    return;
  }

  isSelectingCity = true;
  currentSelectedCityId = cityId;

  try {
    // Update active state in list
    document.querySelectorAll('.city-list-item').forEach((item) => {
      const itemId = parseInt(item.getAttribute('data-city-id'));
      item.classList.toggle('active', itemId === cityId);
    });

    // Dispatch event
    const subscriptions = await getUserSubscriptions();
    const subscription = subscriptions.find(sub => sub.city?.id === cityId);

    document.dispatchEvent(new CustomEvent('citySelected', {
      detail: {
        cityId,
        city: subscription?.city || { id: cityId },
      }
    }));
  } finally {
    setTimeout(() => {
      isSelectingCity = false;
    }, 200);
  }
}

/**
 * Create subscription
 * @param {number|Object} cityIdOrData - City ID or city data object
 * @param {number} period - Update period in hours
 * @param {string} forecastPeriod - Forecast period
 * @param {string} notificationType - Notification type
 * @param {boolean} isActive - Whether subscription is active
 * @returns {Promise<Object>} Created subscription
 */
export async function createSubscription(
  cityIdOrData,
  period = 6,
  forecastPeriod = 'current',
  notificationType = 'email',
  isActive = false
) {
  // Validate forecast period
  if (!VALID_PERIODS.includes(forecastPeriod)) {
    forecastPeriod = 'current';
  }

  const requestBody = {
    period,
    forecast_period: forecastPeriod,
    notification_type: notificationType,
    is_active: isActive,
  };

  if (typeof cityIdOrData === 'number') {
    requestBody.city_id = cityIdOrData;
  } else if (typeof cityIdOrData === 'object') {
    if (cityIdOrData.id) {
      requestBody.city_id = cityIdOrData.id;
    } else {
      requestBody.city_data = {
        name: cityIdOrData.name,
        country: cityIdOrData.country,
        lat: cityIdOrData.lat || cityIdOrData.latitude,
        lon: cityIdOrData.lon || cityIdOrData.longitude,
      };
    }
  } else {
    throw new Error('Invalid city data');
  }

  try {
    const result = await apiPost(API_ENDPOINTS.subscriptions, requestBody);
    // Clear subscriptions cache
    cache.delete(Cache.subscriptionsKey());
    return result;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Update subscription
 * @param {number} subscriptionId - Subscription ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated subscription
 */
export async function updateSubscription(subscriptionId, data) {
  try {
    const result = await apiPatch(API_ENDPOINTS.subscriptionDetail(subscriptionId), data);
    cache.delete(Cache.subscriptionsKey());
    return result;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Delete subscription
 * @param {number} subscriptionId - Subscription ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteSubscription(subscriptionId) {
  try {
    await apiDelete(API_ENDPOINTS.subscriptionDetail(subscriptionId));
    cache.delete(Cache.subscriptionsKey());
    return true;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Get local time for a city
 * @param {Object} city - City object
 * @returns {string} Formatted local time
 */
function getCityLocalTime(city) {
  try {
    const timezone = getTimezoneForCity(city);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const parts = formatter.formatToParts(new Date());
    const hour = parts.find(p => p.type === 'hour')?.value || '12';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || 'AM';

    return `${hour}:${minute} ${dayPeriod}`;
  } catch {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

/**
 * Get timezone for city (simplified)
 * @param {Object} city - City object
 * @returns {string} IANA timezone
 */
function getTimezoneForCity(city) {
  if (!city?.country) return 'UTC';

  const country = city.country.toLowerCase();

  // Common country mappings
  const timezones = {
    ua: 'Europe/Kyiv',
    ukraine: 'Europe/Kyiv',
    gb: 'Europe/London',
    uk: 'Europe/London',
    de: 'Europe/Berlin',
    fr: 'Europe/Paris',
    it: 'Europe/Rome',
    es: 'Europe/Madrid',
    pl: 'Europe/Warsaw',
    ru: 'Europe/Moscow',
    jp: 'Asia/Tokyo',
    cn: 'Asia/Shanghai',
    au: 'Australia/Sydney',
    ca: 'America/Toronto',
    br: 'America/Sao_Paulo',
  };

  // USA - estimate by longitude
  if (['us', 'usa'].includes(country)) {
    const lon = parseFloat(city.longitude);
    if (lon >= -125 && lon < -102) return 'America/Los_Angeles';
    if (lon >= -102 && lon < -90) return 'America/Denver';
    if (lon >= -90 && lon < -75) return 'America/Chicago';
    return 'America/New_York';
  }

  return timezones[country] || 'UTC';
}

/**
 * Update time for all cities in list
 */
function updateCitiesTime() {
  document.querySelectorAll('.city-list-item').forEach((item) => {
    const cityData = item.getAttribute('data-city');
    if (!cityData) return;

    try {
      const city = JSON.parse(cityData);
      const timeEl = item.querySelector('#list-item-time');
      if (timeEl) {
        // Use timezone_offset from stored city data
        const timezoneOffset = city.timezone_offset || 0;
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        timeEl.textContent = formatTime(now, timezoneOffset);
      }
    } catch {}
  });
}

/**
 * Initialize time updates
 */
export function initTimeUpdates() {
  stopTimeUpdates();
  updateCitiesTime();
  timeUpdateInterval = setInterval(updateCitiesTime, 60000);
}

/**
 * Stop time updates
 */
export function stopTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }
}

/**
 * Add new location (focus search)
 */
export function addNewLocation() {
  const searchInput = document.getElementById('city-search');
  if (searchInput) {
    searchInput.focus();
  }
}

/**
 * Get current selected city ID
 * @returns {number|null} Selected city ID
 */
export function getCurrentSelectedCityId() {
  return currentSelectedCityId;
}

/**
 * Show subscription settings modal
 * @param {Object} subscription - Subscription object (null for new)
 * @param {Object} city - City object
 */
export function showSubscriptionSettingsModal(subscription, city) {
  const modal = document.getElementById('subscription-modal');
  if (!modal) return;

  // Set city name
  const cityNameEl = document.getElementById('modal-city-name');
  if (cityNameEl && city) {
    cityNameEl.textContent = `${city.name}, ${city.country}`;
  }

  // Set form values
  setElementValue('modal-period', subscription?.period || 6);
  setElementValue('modal-forecast-period', subscription?.forecast_period || 'current');
  setElementValue('modal-notification-type', subscription?.notification_type || 'email');

  const isActiveEl = document.getElementById('modal-is-active');
  if (isActiveEl) {
    isActiveEl.checked = subscription?.is_active ?? false;
  }

  const activeSection = document.getElementById('modal-active-section');
  if (activeSection) {
    activeSection.style.display = 'block';
  }

  // Update button text
  const submitBtn = document.getElementById('modal-subscribe-btn');
  if (submitBtn) {
    submitBtn.textContent = subscription ? 'Update' : 'Subscribe';
  }

  // Show/hide unsubscribe button
  const unsubscribeBtn = document.getElementById('modal-unsubscribe-btn');
  if (unsubscribeBtn) {
    unsubscribeBtn.classList.toggle('hidden', !subscription?.id);
  }

  modal.classList.remove('hidden');
  setupModalHandlers(subscription, city);
}

/**
 * Set element value helper
 */
function setElementValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

/**
 * Setup modal event handlers
 */
function setupModalHandlers(subscription, city) {
  const submitBtn = document.getElementById('modal-subscribe-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const closeBtn = document.getElementById('modal-close-btn');
  const unsubscribeBtn = document.getElementById('modal-unsubscribe-btn');

  // Remove old handlers by replacing elements
  [submitBtn, cancelBtn, closeBtn, unsubscribeBtn].forEach((btn) => {
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    }
  });

  // Re-get elements after replacement
  const newSubmitBtn = document.getElementById('modal-subscribe-btn');
  const newCancelBtn = document.getElementById('modal-cancel-btn');
  const newCloseBtn = document.getElementById('modal-close-btn');
  const newUnsubscribeBtn = document.getElementById('modal-unsubscribe-btn');

  if (newSubmitBtn) {
    newSubmitBtn.onclick = () => subscription?.id
      ? handleUpdate(subscription.id, city)
      : handleCreate(city);
  }

  if (newCancelBtn) newCancelBtn.onclick = hideModal;
  if (newCloseBtn) newCloseBtn.onclick = hideModal;

  if (newUnsubscribeBtn && subscription?.id) {
    newUnsubscribeBtn.onclick = () => handleUnsubscribe(subscription.id, city);
  }
}

/**
 * Handle subscription update
 */
async function handleUpdate(subscriptionId, city) {
  const data = getModalFormData();
  const submitBtn = document.getElementById('modal-subscribe-btn');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';
    }

    await updateSubscription(subscriptionId, data);
    hideModal();

    const citiesData = await loadSubscribedCitiesWithWeather();
    renderSubscribedCitiesList(citiesData);
    showNotification(`Subscription updated for ${city.name}`, 'success');
  } catch (error) {
    showNotification(error.message || 'Failed to update subscription', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update';
    }
  }
}

/**
 * Handle subscription create
 */
async function handleCreate(city) {
  const data = getModalFormData();
  const submitBtn = document.getElementById('modal-subscribe-btn');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subscribing...';
    }

    await createSubscription(city, data.period, data.forecast_period, data.notification_type, data.is_active);
    hideModal();

    const citiesData = await loadSubscribedCitiesWithWeather();
    renderSubscribedCitiesList(citiesData);
    showNotification(`Successfully subscribed to ${city.name}`, 'success');

    document.dispatchEvent(new CustomEvent('citySelected', {
      detail: { city, cityId: city.id }
    }));
  } catch (error) {
    showNotification(error.message || 'Failed to create subscription', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Subscribe';
    }
  }
}

/**
 * Handle unsubscribe
 */
async function handleUnsubscribe(subscriptionId, city) {
  const cityName = city ? `${city.name}, ${city.country}` : 'this city';

  if (!confirm(`Are you sure you want to unsubscribe from ${cityName}?`)) {
    return;
  }

  const unsubscribeBtn = document.getElementById('modal-unsubscribe-btn');

  try {
    if (unsubscribeBtn) {
      unsubscribeBtn.disabled = true;
      unsubscribeBtn.textContent = 'Unsubscribing...';
    }

    await deleteSubscription(subscriptionId);
    hideModal();

    const citiesData = await loadSubscribedCitiesWithWeather();
    renderSubscribedCitiesList(citiesData);
    showNotification(`Unsubscribed from ${cityName}`, 'success');
  } catch (error) {
    showNotification(error.message || 'Failed to unsubscribe', 'error');
  } finally {
    if (unsubscribeBtn) {
      unsubscribeBtn.disabled = false;
      unsubscribeBtn.textContent = 'Unsubscribe';
    }
  }
}

/**
 * Get form data from modal
 */
function getModalFormData() {
  return {
    period: parseInt(document.getElementById('modal-period')?.value || 6),
    forecast_period: document.getElementById('modal-forecast-period')?.value || 'current',
    notification_type: document.getElementById('modal-notification-type')?.value || 'email',
    is_active: document.getElementById('modal-is-active')?.checked ?? false,
  };
}

/**
 * Hide modal
 */
function hideModal() {
  const modal = document.getElementById('subscription-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Show notification
 * @param {string} message - Message
 * @param {string} type - Type: 'success', 'error', 'info'
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
