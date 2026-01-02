/**
 * Weather API integration
 */

import { apiRequest, handleApiError } from './api.js';
import { getWeatherIcon, formatTemperature, formatTime, formatDate } from './icons.js';

/**
 * Fetch current weather for a city
 */
export async function fetchCurrentWeather(cityId) {
  try {
    const data = await apiRequest(`weather/${cityId}/?period=current`);
    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Fetch weather forecast for a specific period
 */
export async function fetchWeatherForecast(cityId, period = 'current') {
  try {
    const data = await apiRequest(`weather/${cityId}/?period=${period}`);
    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Fetch hourly forecast
 */
export async function fetchHourlyForecast(cityId) {
  try {
    const data = await apiRequest(`weather/${cityId}/?period=hourly`);
    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Fetch weekly forecast
 */
export async function fetchWeeklyForecast(cityId) {
  try {
    const data = await apiRequest(`weather/${cityId}/?period=week`);
    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Update weather display in UI
 */
export function updateWeatherDisplay(weatherData, containerId = 'current-weather-content') {
  const container = document.getElementById(containerId);
  if (!container || !weatherData) return;

  const template = document.getElementById('weather-card-template');
  if (!template) return;

  const clone = template.content.cloneNode(true);

  // Update date
  const dateEl = clone.getElementById('weather-date');
  if (dateEl && weatherData.fetched_at) {
    dateEl.textContent = formatDate(weatherData.fetched_at);
  }

  // Update city name
  const cityEl = clone.getElementById('weather-city');
  if (cityEl && weatherData.city) {
    cityEl.textContent = weatherData.city.name || weatherData.city;
  }

  // Update description
  const descEl = clone.getElementById('weather-description');
  if (descEl && weatherData.description) {
    descEl.textContent = weatherData.description;
  }

  // Update temperature
  const tempEl = clone.getElementById('weather-temp');
  if (tempEl && weatherData.temperature !== undefined) {
    tempEl.textContent = formatTemperature(weatherData.temperature);
  }

  // Update high/low
  const highEl = clone.getElementById('weather-high');
  const lowEl = clone.getElementById('weather-low');
  if (highEl && weatherData.temp_max !== undefined) {
    highEl.textContent = `H ${formatTemperature(weatherData.temp_max)}`;
  }
  if (lowEl && weatherData.temp_min !== undefined) {
    lowEl.textContent = `L ${formatTemperature(weatherData.temp_min)}`;
  }

  // Update icon
  const iconEl = clone.getElementById('weather-icon-large');
  if (iconEl && weatherData.description) {
    const icon = getWeatherIcon(weatherData.description, 'large');
    iconEl.innerHTML = '';
    iconEl.appendChild(icon);
  }

  container.innerHTML = '';
  container.appendChild(clone);
}

/**
 * Update hourly forecast display
 */
export function updateHourlyForecast(hourlyData, containerId = 'hourly-forecast-container') {
  const container = document.getElementById(containerId);
  if (!container || !hourlyData || !Array.isArray(hourlyData)) return;

  const template = document.getElementById('hourly-item-template');
  if (!template) return;

  container.innerHTML = '';

  hourlyData.slice(0, 24).forEach((item) => {
    const clone = template.content.cloneNode(true);

    const timeEl = clone.getElementById('hourly-time');
    if (timeEl && item.dt) {
      timeEl.textContent = formatTime(item.dt * 1000);
    }

    const iconEl = clone.getElementById('hourly-icon');
    if (iconEl && item.weather && item.weather[0]) {
      const icon = getWeatherIcon(item.weather[0].description, 'small');
      iconEl.innerHTML = '';
      iconEl.appendChild(icon);
    }

    const tempEl = clone.getElementById('hourly-temp');
    if (tempEl && item.temp !== undefined) {
      tempEl.textContent = formatTemperature(item.temp);
    }

    container.appendChild(clone);
  });
}

/**
 * Update air conditions display
 */
export function updateAirConditions(weatherData, containerId = 'air-conditions-grid') {
  const container = document.getElementById(containerId);
  if (!container || !weatherData) return;

  const template = document.getElementById('air-condition-item-template');
  if (!template) return;

  container.innerHTML = '';

  const conditions = [
    {
      label: 'Real Feel',
      value: formatTemperature(weatherData.feels_like),
      icon: 'thermometer',
    },
    {
      label: 'Chance of rain',
      value: weatherData.pop ? `${Math.round(weatherData.pop * 100)}%` : '0%',
      icon: 'raindrop',
    },
    {
      label: 'Wind',
      value: weatherData.wind_speed ? `${weatherData.wind_speed} km/h` : '0 km/h',
      icon: 'wind',
    },
    {
      label: 'UV Index',
      value: weatherData.uvi || '3',
      icon: 'sun',
    },
  ];

  conditions.forEach((condition) => {
    const clone = template.content.cloneNode(true);

    const labelEl = clone.getElementById('condition-label');
    if (labelEl) {
      labelEl.textContent = condition.label;
    }

    const valueEl = clone.getElementById('condition-value');
    if (valueEl) {
      valueEl.textContent = condition.value;
    }

    const iconEl = clone.getElementById('condition-icon');
    if (iconEl) {
      const icon = getConditionIcon(condition.icon);
      iconEl.innerHTML = '';
      iconEl.appendChild(icon);
    }

    container.appendChild(clone);
  });
}

/**
 * Get icon for air condition
 */
function getConditionIcon(type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'w-6 h-6 text-dark-text-secondary');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');

  const paths = {
    thermometer: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
    raindrop: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />',
    wind: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-4.243 4.243a3 3 0 01-4.243 0L5.343 12.343z" />',
    sun: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />',
  };

  svg.innerHTML = paths[type] || paths.thermometer;
  return svg;
}

