/**
 * Subscriptions management
 */

import { apiRequest, handleApiError } from './api.js';
import { fetchCurrentWeather } from './weather.js';
import { getWeatherIcon, formatTemperature, formatTime } from './icons.js';

let currentSelectedCityId = null;
let isSelectingCity = false; // Prevent multiple simultaneous selections

/**
 * Get user subscriptions
 */
export async function getUserSubscriptions() {
  try {
    const data = await apiRequest('subscriptions/');
    // Handle paginated response (results) or direct array
    return data.results || (Array.isArray(data) ? data : []);
  } catch (error) {
    if (error.message.includes('401') || error.status === 401) {
      // User not authenticated, return empty array
      return [];
    }
    handleApiError(error);
    return [];
  }
}

/**
 * Load subscribed cities with current weather
 */
export async function loadSubscribedCitiesWithWeather() {
  try {
    const subscriptions = await getUserSubscriptions();

    if (!subscriptions || subscriptions.length === 0) {
      return [];
    }

    const citiesData = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const weather = await fetchCurrentWeather(subscription.city.id);
          return {
            subscription,
            city: subscription.city,
            weather,
          };
        } catch (error) {
          console.error(`Failed to load weather for city ${subscription.city.id}:`, error);
          return {
            subscription,
            city: subscription.city,
            weather: null,
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

      // Add click handler with debouncing
      let clickTimeout = null;
      listItem.addEventListener('click', () => {
        // Debounce clicks - ignore if clicked within 300ms
        if (clickTimeout) {
          clearTimeout(clickTimeout);
        }
        clickTimeout = setTimeout(() => {
          selectCityFromList(item.city.id);
        }, 100);
      });
    }

    const cityEl = clone.getElementById('list-item-city');
    if (cityEl) {
      cityEl.textContent = item.city.name;

      // Apply muted style if subscription is inactive
      if (item.subscription && item.subscription.is_active === false) {
        cityEl.classList.add('text-dark-text-secondary', 'opacity-60');
      } else {
        cityEl.classList.remove('text-dark-text-secondary', 'opacity-60');
        cityEl.classList.add('text-dark-text-primary');
      }
    }

    // Display local time for the city
    const timeEl = clone.getElementById('list-item-time');
    if (timeEl) {
      const cityTime = getCityLocalTime(item.city);
      timeEl.textContent = cityTime;
    }

    // Store city data in data attribute for time updates
    if (listItem && item.city) {
      try {
        listItem.setAttribute('data-city', JSON.stringify({
          country: item.city.country,
          name: item.city.name,
          latitude: item.city.latitude,
          longitude: item.city.longitude,
        }));
      } catch (error) {
        console.error('Failed to store city data:', error);
      }
    }

    const iconEl = clone.getElementById('list-item-icon');
    if (iconEl && item.weather && item.weather.description) {
      const icon = getWeatherIcon(item.weather.description, 'small');
      iconEl.innerHTML = '';
      iconEl.appendChild(icon);
    }

    const tempEl = clone.getElementById('list-item-temp');
    if (tempEl && item.weather && item.weather.temperature !== undefined) {
      tempEl.textContent = formatTemperature(item.weather.temperature);
    } else if (tempEl) {
      tempEl.textContent = '--';
    }

    // Setup settings button
    const settingsBtn = clone.querySelector('.settings-btn');
    if (settingsBtn && item.subscription && item.subscription.id) {
      settingsBtn.setAttribute('data-subscription-id', item.subscription.id);
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSubscriptionSettingsModal(item.subscription, item.city);
      });
    }

    // Store subscription ID in list item
    if (listItem && item.subscription && item.subscription.id) {
      listItem.setAttribute('data-subscription-id', item.subscription.id);
    }

    listContainer.appendChild(clone);
  });
}

/**
 * Select city from list
 */
export async function selectCityFromList(cityId) {
  // Prevent multiple simultaneous selections
  if (isSelectingCity || currentSelectedCityId === cityId) {
    return;
  }

  isSelectingCity = true;
  currentSelectedCityId = cityId;

  try {
    // Update active state in list
    const listItems = document.querySelectorAll('.city-list-item');
    listItems.forEach((item) => {
      if (parseInt(item.getAttribute('data-city-id')) === cityId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Get city data from subscriptions list to pass full city object
    const subscriptions = await getUserSubscriptions();
    const subscription = subscriptions.find(sub => sub.city && sub.city.id === cityId);
    const city = subscription ? subscription.city : null;

    // Dispatch event for city selection with city data
    const event = new CustomEvent('citySelected', {
      detail: {
        cityId,
        city: city || { id: cityId }
      }
    });
    document.dispatchEvent(event);
  } finally {
    // Reset flag after a short delay to allow event processing
    setTimeout(() => {
      isSelectingCity = false;
    }, 200);
  }
}

/**
 * Create subscription
 * @param {number|object} cityIdOrData - City ID (if city exists in DB) or city data object {id, name, country, lat, lon}
 * @param {number} period - Update period in hours
 * @param {string} forecastPeriod - Forecast period
 * @param {string} notificationType - Notification type
 * @param {boolean} isActive - Whether subscription is active (default: false)
 */
export async function createSubscription(cityIdOrData, period = 6, forecastPeriod = 'current', notificationType = 'email', isActive = false) {
  try {
    // Prepare request body
    // New subscriptions are created as inactive by default
    const requestBody = {
      period,
      forecast_period: forecastPeriod,
      notification_type: notificationType,
      is_active: isActive,
    };

    // If cityIdOrData is a number, use city_id
    // If it's an object without id, use city_data
    if (typeof cityIdOrData === 'number') {
      requestBody.city_id = cityIdOrData;
    } else if (typeof cityIdOrData === 'object') {
      if (cityIdOrData.id) {
        // City has ID (from DB)
        requestBody.city_id = cityIdOrData.id;
      } else {
        // City from API (no ID) - send city_data to create in DB
        requestBody.city_data = {
          name: cityIdOrData.name,
          country: cityIdOrData.country,
          lat: cityIdOrData.lat || cityIdOrData.latitude,
          lon: cityIdOrData.lon || cityIdOrData.longitude,
        };
      }
    } else {
      throw new Error('Invalid city data: must be city ID (number) or city object');
    }

    const data = await apiRequest('subscriptions/', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Update subscription
 */
export async function updateSubscription(subscriptionId, data) {
  try {
    const result = await apiRequest(`subscriptions/${subscriptionId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Delete subscription
 */
export async function deleteSubscription(subscriptionId) {
  try {
    await apiRequest(`subscriptions/${subscriptionId}/`, {
      method: 'DELETE',
    });
    return true;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Handle unsubscribe with confirmation
 */
async function handleUnsubscribe(subscriptionId, city) {
  // Show confirmation dialog
  const cityName = city ? `${city.name}, ${city.country}` : 'this city';
  const confirmed = confirm(
    `Are you sure you want to unsubscribe from ${cityName}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) {
    return; // User cancelled
  }

  try {
    // Disable unsubscribe button during deletion
    const unsubscribeBtn = document.getElementById('modal-unsubscribe-btn');
    if (unsubscribeBtn) {
      unsubscribeBtn.disabled = true;
      unsubscribeBtn.textContent = 'Unsubscribing...';
    }

    // Delete subscription
    await deleteSubscription(subscriptionId);

    // Hide modal
    hideSubscriptionModal();

    // Reload subscriptions list
    const citiesData = await loadSubscribedCitiesWithWeather();
    renderSubscribedCitiesList(citiesData);

    // Show success message
    showNotification(`Unsubscribed from ${cityName}`, 'success');
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    const errorMsg = error.message || 'Failed to unsubscribe';
    showNotification(errorMsg, 'error');
  } finally {
    // Re-enable button (in case of error)
    const unsubscribeBtn = document.getElementById('modal-unsubscribe-btn');
    if (unsubscribeBtn) {
      unsubscribeBtn.disabled = false;
      unsubscribeBtn.textContent = 'Unsubscribe';
    }
  }
}

/**
 * Get timezone for a city based on country
 * @param {object} city - City object with country
 * @returns {string} IANA timezone string
 */
function getCityTimezone(city) {
  if (!city || !city.country) {
    // Default to UTC if country not available
    return 'UTC';
  }

  const country = city.country.toLowerCase();
  const cityName = city.name ? city.name.toLowerCase() : '';

  // Map countries to their timezones
  // For Ukraine, all cities use Europe/Kyiv
  if (country === 'ua' || country === 'ukraine' || country === 'україна') {
    return 'Europe/Kyiv';
  }

  // For USA, determine timezone based on city name or coordinates
  if (country === 'us' || country === 'usa' || country === 'united states') {
    // Major US cities timezone mapping
    if (cityName.includes('san francisco') || cityName.includes('los angeles') ||
        cityName.includes('seattle') || cityName.includes('portland') ||
        cityName.includes('san diego') || cityName.includes('las vegas')) {
      return 'America/Los_Angeles'; // Pacific Time
    }
    if (cityName.includes('new york') || cityName.includes('boston') ||
        cityName.includes('washington') || cityName.includes('miami') ||
        cityName.includes('atlanta') || cityName.includes('philadelphia')) {
      return 'America/New_York'; // Eastern Time
    }
    if (cityName.includes('chicago') || cityName.includes('dallas') ||
        cityName.includes('houston') || cityName.includes('minneapolis') ||
        cityName.includes('detroit')) {
      return 'America/Chicago'; // Central Time
    }
    if (cityName.includes('denver') || cityName.includes('phoenix') ||
        cityName.includes('salt lake') || cityName.includes('albuquerque')) {
      return 'America/Denver'; // Mountain Time
    }

    // Fallback: use coordinates to estimate timezone
    // Rough approximation: -120 to -105 = Pacific, -105 to -90 = Mountain,
    // -90 to -75 = Central, -75 to -60 = Eastern
    if (city.longitude !== undefined) {
      const lon = parseFloat(city.longitude);
      if (lon >= -125 && lon < -102) {
        return 'America/Los_Angeles'; // Pacific
      } else if (lon >= -102 && lon < -90) {
        return 'America/Denver'; // Mountain
      } else if (lon >= -90 && lon < -75) {
        return 'America/Chicago'; // Central
      } else if (lon >= -75 && lon < -60) {
        return 'America/New_York'; // Eastern
      }
    }

    // Default to Eastern Time for USA if unknown
    return 'America/New_York';
  }

  // For other countries, try to determine based on coordinates or country
  // This is a simplified mapping - for production, consider using a timezone library
  if (country === 'gb' || country === 'uk' || country === 'united kingdom') {
    return 'Europe/London';
  }
  if (country === 'de' || country === 'germany') {
    return 'Europe/Berlin';
  }
  if (country === 'fr' || country === 'france') {
    return 'Europe/Paris';
  }
  if (country === 'it' || country === 'italy') {
    return 'Europe/Rome';
  }
  if (country === 'es' || country === 'spain') {
    return 'Europe/Madrid';
  }
  if (country === 'ru' || country === 'russia') {
    // Russia spans multiple timezones, default to Moscow
    return 'Europe/Moscow';
  }
  if (country === 'jp' || country === 'japan') {
    return 'Asia/Tokyo';
  }
  if (country === 'cn' || country === 'china') {
    return 'Asia/Shanghai';
  }
  if (country === 'au' || country === 'australia') {
    // Australia spans multiple timezones, default to Sydney
    return 'Australia/Sydney';
  }

  // Default to UTC for unknown countries
  return 'UTC';
}

/**
 * Get local time for a city based on its timezone
 * @param {object} city - City object with country
 * @returns {string} Formatted local time string
 */
function getCityLocalTime(city) {
  try {
    const timezone = getCityTimezone(city);

    // Use Intl.DateTimeFormat to get time in the city's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Format the time
    const parts = formatter.formatToParts(now);
    const hour = parts.find(p => p.type === 'hour')?.value || '12';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || 'AM';

    return `${hour}:${minute} ${dayPeriod}`;
  } catch (error) {
    console.error('Error calculating city local time:', error);
    // Fallback to current time
    return formatTime(new Date());
  }
}

/**
 * Update time for all cities in the list
 */
function updateCitiesTime() {
  const listItems = document.querySelectorAll('.city-list-item');

  listItems.forEach((item) => {
    const cityId = item.getAttribute('data-city-id');
    if (!cityId) return;

    // Get city data from the subscriptions (we need to store it or fetch it)
    // For now, we'll get it from the data attribute or reconstruct from the list
    const cityName = item.querySelector('#list-item-city')?.textContent;

    // Try to get city data from stored subscriptions
    // We need to store city data when rendering
    const cityData = item.getAttribute('data-city');
    if (cityData) {
      try {
        const city = JSON.parse(cityData);
        const timeEl = item.querySelector('#list-item-time');
        if (timeEl) {
          timeEl.textContent = getCityLocalTime(city);
        }
      } catch (error) {
        console.error('Failed to parse city data:', error);
      }
    }
  });
}

/**
 * Initialize time update interval
 */
let timeUpdateInterval = null;

export function initTimeUpdates() {
  // Clear existing interval if any
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }

  // Update time immediately
  updateCitiesTime();

  // Update time every minute (60000 ms)
  timeUpdateInterval = setInterval(() => {
    updateCitiesTime();
  }, 60000);
}

/**
 * Stop time update interval
 */
export function stopTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }
}

/**
 * Add new location handler
 */
export function addNewLocation() {
  const searchInput = document.getElementById('city-search');
  if (searchInput) {
    searchInput.focus();
  }
}

/**
 * Get current selected city ID
 */
export function getCurrentSelectedCityId() {
  return currentSelectedCityId;
}

/**
 * Show subscription settings modal for editing
 */
export function showSubscriptionSettingsModal(subscription, city) {
  const modal = document.getElementById('subscription-modal');
  if (!modal) {
    console.error('Subscription modal not found');
    return;
  }

  // Set city name
  const cityNameEl = document.getElementById('modal-city-name');
  if (cityNameEl && city) {
    cityNameEl.textContent = `${city.name}, ${city.country}`;
  }

  // Set current subscription values
  const periodEl = document.getElementById('modal-period');
  const forecastPeriodEl = document.getElementById('modal-forecast-period');
  const notificationTypeEl = document.getElementById('modal-notification-type');
  const isActiveEl = document.getElementById('modal-is-active');
  const activeSection = document.getElementById('modal-active-section');

  if (periodEl) {
    periodEl.value = subscription?.period || 6;
  }
  if (forecastPeriodEl) {
    forecastPeriodEl.value = subscription?.forecast_period || 'current';
  }
  if (notificationTypeEl) {
    notificationTypeEl.value = subscription?.notification_type || 'email';
  }
  if (isActiveEl) {
    if (subscription) {
      // Editing existing subscription - use its current status
      isActiveEl.checked = subscription.is_active !== undefined ? subscription.is_active : false;
    } else {
      // Creating new subscription - default to inactive
      isActiveEl.checked = false;
    }
  }
  // Always show active section (for both creating and editing)
  if (activeSection) {
    activeSection.style.display = 'block';
  }

  // Update button text
  const submitBtn = document.getElementById('modal-subscribe-btn');
  if (submitBtn) {
    submitBtn.textContent = subscription ? 'Update' : 'Subscribe';
  }

  // Show/hide unsubscribe button (only for existing subscriptions)
  const unsubscribeBtn = document.getElementById('modal-unsubscribe-btn');
  if (unsubscribeBtn) {
    if (subscription && subscription.id) {
      unsubscribeBtn.classList.remove('hidden');
    } else {
      unsubscribeBtn.classList.add('hidden');
    }
  }

  // Show modal
  modal.classList.remove('hidden');

  // Setup handlers
  setupSubscriptionModalHandlers(subscription, city);
}

/**
 * Setup subscription modal handlers
 */
function setupSubscriptionModalHandlers(subscription, city) {
  const submitBtn = document.getElementById('modal-subscribe-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const closeBtn = document.getElementById('modal-close-btn');
  const unsubscribeBtn = document.getElementById('modal-unsubscribe-btn');

  // Remove existing handlers by cloning buttons
  const newSubmitBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

  // Clone unsubscribe button if it exists
  let newUnsubscribeBtn = null;
  if (unsubscribeBtn) {
    newUnsubscribeBtn = unsubscribeBtn.cloneNode(true);
    unsubscribeBtn.parentNode.replaceChild(newUnsubscribeBtn, unsubscribeBtn);
  }

  // Add new handlers
  if (newSubmitBtn) {
    if (subscription && subscription.id) {
      // Editing existing subscription
      newSubmitBtn.onclick = () => handleSubscriptionUpdate(subscription.id, city);
    } else {
      // Creating new subscription
      newSubmitBtn.onclick = () => handleSubscriptionCreate(city);
    }
  }

  if (newCancelBtn) {
    newCancelBtn.onclick = hideSubscriptionModal;
  }

  if (newCloseBtn) {
    newCloseBtn.onclick = hideSubscriptionModal;
  }

  // Add unsubscribe handler (only for existing subscriptions)
  if (newUnsubscribeBtn && subscription && subscription.id) {
    newUnsubscribeBtn.onclick = () => handleUnsubscribe(subscription.id, city);
  }
}

/**
 * Handle subscription update
 */
async function handleSubscriptionUpdate(subscriptionId, city) {
  const period = document.getElementById('modal-period')?.value || 6;
  const forecastPeriod = document.getElementById('modal-forecast-period')?.value || 'current';
  const notificationType = document.getElementById('modal-notification-type')?.value || 'email';
  const isActive = document.getElementById('modal-is-active')?.checked ?? true;

  try {
    const submitBtn = document.getElementById('modal-subscribe-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';
    }

    await updateSubscription(subscriptionId, {
      period: parseInt(period),
      forecast_period: forecastPeriod,
      notification_type: notificationType,
      is_active: isActive,
    });

    // Hide modal
    hideSubscriptionModal();

    // Reload subscriptions list
    const citiesData = await loadSubscribedCitiesWithWeather();
    renderSubscribedCitiesList(citiesData);

    // Show success message
    showNotification(`Subscription updated for ${city.name}`, 'success');
  } catch (error) {
    console.error('Failed to update subscription:', error);
    const errorMsg = error.response?.period?.[0] || error.message || 'Failed to update subscription';
    showNotification(errorMsg, 'error');
  } finally {
    const submitBtn = document.getElementById('modal-subscribe-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update';
    }
  }
}

/**
 * Handle subscription create (from modal)
 */
async function handleSubscriptionCreate(city) {
  const period = document.getElementById('modal-period')?.value || 6;
  const forecastPeriod = document.getElementById('modal-forecast-period')?.value || 'current';
  const notificationType = document.getElementById('modal-notification-type')?.value || 'email';
  const isActive = document.getElementById('modal-is-active')?.checked ?? false;

  try {
    const submitBtn = document.getElementById('modal-subscribe-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subscribing...';
    }

    // Pass city object (with or without id) - function will handle it
    // Note: New subscriptions are created as inactive by default
    await createSubscription(city, parseInt(period), forecastPeriod, notificationType, isActive);

    // Hide modal
    hideSubscriptionModal();

    // Reload subscriptions list
    const citiesData = await loadSubscribedCitiesWithWeather();
    renderSubscribedCitiesList(citiesData);

    // Show success message
    showNotification(`Successfully subscribed to ${city.name}`, 'success');

    // Select the newly subscribed city
    const event = new CustomEvent('citySelected', { detail: { city, cityId: city.id } });
    document.dispatchEvent(event);
  } catch (error) {
    console.error('Failed to create subscription:', error);
    const errorMsg = error.response?.city_id?.[0] || error.message || 'Failed to create subscription';
    showNotification(errorMsg, 'error');
  } finally {
    const submitBtn = document.getElementById('modal-subscribe-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Subscribe';
    }
  }
}

/**
 * Hide subscription modal
 */
function hideSubscriptionModal() {
  const modal = document.getElementById('subscription-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  // Reset form - keep active section visible but uncheck checkbox
  const isActiveEl = document.getElementById('modal-is-active');
  if (isActiveEl) {
    isActiveEl.checked = false;
  }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
    type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'
  } text-white`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

