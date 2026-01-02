/**
 * Subscriptions management
 */

import { apiRequest, handleApiError } from './api.js';
import { fetchCurrentWeather } from './weather.js';
import { getWeatherIcon, formatTemperature, formatTime } from './icons.js';

let currentSelectedCityId = null;

/**
 * Get user subscriptions
 */
export async function getUserSubscriptions() {
  try {
    const data = await apiRequest('subscriptions/');
    return data.results || data;
  } catch (error) {
    if (error.message.includes('401')) {
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

      listItem.addEventListener('click', () => {
        selectCityFromList(item.city.id);
      });
    }

    const timeEl = clone.getElementById('list-item-time');
    if (timeEl && item.weather && item.weather.fetched_at) {
      timeEl.textContent = formatTime(item.weather.fetched_at);
    } else if (timeEl) {
      timeEl.textContent = formatTime(new Date());
    }

    const cityEl = clone.getElementById('list-item-city');
    if (cityEl) {
      cityEl.textContent = item.city.name;
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

    listContainer.appendChild(clone);
  });
}

/**
 * Select city from list
 */
export function selectCityFromList(cityId) {
  currentSelectedCityId = cityId;

  // Update active state in list
  const listItems = document.querySelectorAll('.city-list-item');
  listItems.forEach((item) => {
    if (parseInt(item.getAttribute('data-city-id')) === cityId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Dispatch event for city selection
  const event = new CustomEvent('citySelected', { detail: { cityId } });
  document.dispatchEvent(event);
}

/**
 * Create subscription
 */
export async function createSubscription(cityId, period = 6, forecastPeriod = 'current', notificationType = 'email') {
  try {
    const data = await apiRequest('subscriptions/', {
      method: 'POST',
      body: JSON.stringify({
        city: cityId,
        period,
        forecast_period: forecastPeriod,
        notification_type: notificationType,
        is_active: true,
      }),
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

