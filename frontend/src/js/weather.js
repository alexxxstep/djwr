/**
 * Weather API integration
 * Refactored version - clean, uses new API format
 *
 * API Response Format:
 * {
 *   city: { id, name, country, latitude, longitude },
 *   period: "current" | "hourly" | "today" | "tomorrow" | "3days" | "week",
 *   meta: { count, fetched_at, cache_ttl },
 *   data: [{ dt, temp, feels_like, humidity, pressure, wind_speed, description, icon, ... }]
 * }
 */

import { apiGet, handleApiError } from './api.js';
import { API_ENDPOINTS, isValidPeriod, DEFAULT_PERIOD, getCacheTTL } from './config.js';
import cache, { Cache } from './cache.js';
import { getWeatherIcon, getParameterIcon, formatTemperature, formatTime, formatDate } from './icons.js';
import { initDragToScroll } from './ui.js';

// Store current city timezone offset for time updates
let currentCityTimezoneOffset = 0;
let currentWeatherTimeInterval = null;

/**
 * Fetch weather data for a city
 * @param {number} cityId - City ID
 * @param {string} period - Forecast period
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<Object>} Weather response
 */
export async function fetchWeatherForecast(cityId, period = DEFAULT_PERIOD, useCache = true) {
  // Validate period
  if (!isValidPeriod(period)) {
    console.warn(`Invalid period "${period}", using "${DEFAULT_PERIOD}"`);
    period = DEFAULT_PERIOD;
  }

  // Check cache first
  const cacheKey = Cache.weatherKey(cityId, period);
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const response = await apiGet(API_ENDPOINTS.weather(cityId, period));

    // Cache the response using TTL from response or config
    const ttl = response?.meta?.cache_ttl || getCacheTTL(period);
    cache.set(cacheKey, response, ttl);

    return response;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Fetch current weather (shorthand)
 * @param {number} cityId - City ID
 * @returns {Promise<Object>} Weather response
 */
export function fetchCurrentWeather(cityId) {
  return fetchWeatherForecast(cityId, 'current');
}

/**
 * Fetch hourly forecast (shorthand)
 * @param {number} cityId - City ID
 * @returns {Promise<Object>} Weather response
 */
export function fetchHourlyForecast(cityId) {
  return fetchWeatherForecast(cityId, 'hourly');
}

/**
 * Fetch weekly forecast (shorthand)
 * @param {number} cityId - City ID
 * @returns {Promise<Object>} Weather response
 */
export function fetchWeeklyForecast(cityId) {
  return fetchWeatherForecast(cityId, 'week');
}

/**
 * Extract data array from weather response
 * @param {Object} response - Weather API response
 * @returns {Array} Weather data array
 */
export function getWeatherDataArray(response) {
  if (!response?.data) return [];
  return Array.isArray(response.data) ? response.data : [];
}

/**
 * Extract first weather item from response
 * @param {Object} response - Weather API response
 * @returns {Object|null} First weather data item
 */
export function getFirstWeatherItem(response) {
  const data = getWeatherDataArray(response);
  return data.length > 0 ? data[0] : null;
}

/**
 * Update main weather display
 * @param {Object} response - Weather API response
 * @param {string} containerId - Container element ID
 */
export function updateWeatherDisplay(response, containerId = 'current-weather-content') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const template = document.getElementById('weather-card-template');
  if (!template) return;

  const weatherData = getFirstWeatherItem(response);
  if (!weatherData) {
    container.innerHTML = '<div class="text-center py-8 text-dark-text-secondary">No weather data available</div>';
    return;
  }

  const clone = template.content.cloneNode(true);

  // Date
  const dateEl = clone.getElementById('weather-date');
  if (dateEl && response.meta?.fetched_at) {
    dateEl.textContent = formatDate(response.meta.fetched_at);
  }

  // City name with country code
  const cityEl = clone.getElementById('weather-city');
  if (cityEl && response.city) {
    const cityName = response.city.name;
    const countryCode = response.city.country || '';
    cityEl.textContent = countryCode ? `${cityName} (${countryCode})` : cityName;
  }

  // City local time (use timezone_offset from API response)
  const timeEl = clone.getElementById('weather-time');
  const timezoneOffset = response?.timezone_offset || 0;
  currentCityTimezoneOffset = timezoneOffset; // Store for updates
  if (timeEl) {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    timeEl.textContent = formatTime(now, timezoneOffset);
  }

  // Description
  const descEl = clone.getElementById('weather-description');
  if (descEl && weatherData.description) {
    descEl.textContent = weatherData.description;
  }

  // Temperature
  const tempEl = clone.getElementById('weather-temp');
  if (tempEl && weatherData.temp !== undefined) {
    tempEl.textContent = formatTemperature(weatherData.temp);
  }

  // High/Low (show only if both available)
  const highEl = clone.getElementById('weather-high');
  const lowEl = clone.getElementById('weather-low');
  const tempRangeContainer = highEl?.parentElement;

  if (highEl && lowEl && tempRangeContainer) {
    if (weatherData.temp_max !== null && weatherData.temp_max !== undefined &&
        weatherData.temp_min !== null && weatherData.temp_min !== undefined) {
      highEl.textContent = `H ${formatTemperature(weatherData.temp_max)}`;
      lowEl.textContent = `L ${formatTemperature(weatherData.temp_min)}`;
      tempRangeContainer.style.display = '';
    } else {
      tempRangeContainer.style.display = 'none';
    }
  }

  // Icon
  const iconEl = clone.getElementById('weather-icon-large');
  if (iconEl && weatherData.description) {
    const icon = getWeatherIcon(weatherData.description, 'large');
    iconEl.innerHTML = '';
    iconEl.appendChild(icon);
  }

  // Air conditions - show only fields with data
  updateCurrentWeatherConditions(clone, weatherData);

  container.innerHTML = '';
  container.appendChild(clone);

  // Start time updates for current weather
  startCurrentWeatherTimeUpdates();
}

/**
 * Start time updates for current weather display
 */
function startCurrentWeatherTimeUpdates() {
  // Clear existing interval
  if (currentWeatherTimeInterval) {
    clearInterval(currentWeatherTimeInterval);
  }

  // Update time every minute
  currentWeatherTimeInterval = setInterval(() => {
    const timeEl = document.getElementById('weather-time');
    if (timeEl && currentCityTimezoneOffset !== null) {
      const now = Math.floor(Date.now() / 1000);
      timeEl.textContent = formatTime(now, currentCityTimezoneOffset);
    }
  }, 60000); // Update every minute
}

/**
 * Stop time updates for current weather display
 */
export function stopCurrentWeatherTimeUpdates() {
  if (currentWeatherTimeInterval) {
    clearInterval(currentWeatherTimeInterval);
    currentWeatherTimeInterval = null;
  }
}

/**
 * Update current weather conditions section
 * Shows only fields that have data (not null/undefined)
 * @param {DocumentFragment} clone - Template clone
 * @param {Object} weatherData - Weather data item
 */
/**
 * Get human-readable parameter name
 * @param {string} parameter - Parameter identifier
 * @returns {string} Human-readable name
 */
function getParameterName(parameter) {
  const names = {
    'feels-like': 'Feels Like',
    'real-feel': 'Feels Like',
    'humidity': 'Humidity',
    'pressure': 'Pressure',
    'wind': 'Wind Speed',
    'wind-deg': 'Wind Direction',
    'wind-direction': 'Wind Direction',
    'visibility': 'Visibility',
    'clouds': 'Clouds',
    'uvi': 'UV Index',
    'uv-index': 'UV Index',
    'pop': 'Precipitation',
    'precipitation': 'Precipitation',
    'rain': 'Rain',
    'snow': 'Snow',
  };

  const paramLower = (parameter || '').toLowerCase();
  return names[paramLower] || parameter;
}

function updateCurrentWeatherConditions(clone, weatherData) {
  // Helper to show/hide condition row based on data availability
  const toggleCondition = (rowId, iconElId, valueElId, parameter, value, formatter = (v) => v) => {
    const row = clone.getElementById(rowId);
    const iconEl = clone.getElementById(iconElId);
    const valueEl = clone.getElementById(valueElId);

    if (row && valueEl) {
      if (value !== null && value !== undefined) {
        row.classList.remove('hidden');
        valueEl.textContent = formatter(value);

        // Add tooltip (title attribute)
        row.setAttribute('title', getParameterName(parameter));
        valueEl.setAttribute('title', getParameterName(parameter));

        // Insert icon
        if (iconEl) {
          iconEl.innerHTML = '';
          const icon = getParameterIcon(parameter, 'small');
          iconEl.appendChild(icon);
        }
      } else {
        row.classList.add('hidden');
      }
    }
  };

  // Real Feel (feels_like)
  toggleCondition('weather-feels-like-row', 'weather-feels-like-icon', 'weather-feels-like', 'feels-like', weatherData.feels_like, (v) => formatTemperature(v));

  // Humidity
  toggleCondition('weather-humidity-row', 'weather-humidity-icon', 'weather-humidity', 'humidity', weatherData.humidity, (v) => `${v}%`);

  // Pressure
  toggleCondition('weather-pressure-row', 'weather-pressure-icon', 'weather-pressure', 'pressure', weatherData.pressure, (v) => `${v} hPa`);

  // Wind Speed
  toggleCondition('weather-wind-row', 'weather-wind-icon', 'weather-wind', 'wind', weatherData.wind_speed, (v) => `${v} km/h`);

  // Wind Direction (wind_deg)
  toggleCondition('weather-wind-deg-row', 'weather-wind-deg-icon', 'weather-wind-deg', 'wind-deg', weatherData.wind_deg, (v) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(v / 22.5) % 16;
    return `${directions[index]} (${v}°)`;
  });

  // Visibility
  toggleCondition('weather-visibility-row', 'weather-visibility-icon', 'weather-visibility', 'visibility', weatherData.visibility, (v) => {
    if (v >= 1000) {
      return `${(v / 1000).toFixed(1)} km`;
    }
    return `${v} m`;
  });

  // Clouds
  toggleCondition('weather-clouds-row', 'weather-clouds-icon', 'weather-clouds', 'clouds', weatherData.clouds, (v) => `${v}%`);

  // UV Index
  toggleCondition('weather-uvi-row', 'weather-uvi-icon', 'weather-uv', 'uvi', weatherData.uvi, (v) => v.toString());

  // Precipitation Probability (pop)
  toggleCondition('weather-pop-row', 'weather-pop-icon', 'weather-pop', 'precipitation', weatherData.pop, (v) => `${Math.round(v * 100)}%`);

  // Rain (if available)
  toggleCondition('weather-rain-row', 'weather-rain-icon', 'weather-rain', 'rain', weatherData.rain, (v) => {
    if (typeof v === 'object' && v['1h']) {
      return `${v['1h']} mm`;
    }
    return `${v} mm`;
  });

  // Snow (if available)
  toggleCondition('weather-snow-row', 'weather-snow-icon', 'weather-snow', 'snow', weatherData.snow, (v) => {
    if (typeof v === 'object' && v['1h']) {
      return `${v['1h']} mm`;
    }
    return `${v} mm`;
  });
}

/**
 * Update hourly/daily forecast display
 * @param {Array|Object} dataOrResponse - Weather data array or API response
 * @param {string} period - Display period
 * @param {string} containerId - Container element ID
 */
export function updateHourlyForecast(dataOrResponse, period = 'today', containerId = 'hourly-forecast-container') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Hourly forecast container not found:', containerId);
    return;
  }

  const template = document.getElementById('hourly-item-template');
  if (!template) {
    console.error('Hourly item template not found');
    return;
  }

  // Extract data array and timezone offset
  let data = [];
  let timezoneOffset = 0;

  if (Array.isArray(dataOrResponse)) {
    // If it's already an array, use it directly
    data = dataOrResponse;
    console.log('updateHourlyForecast: dataOrResponse is array, length:', data.length);
  } else if (dataOrResponse && typeof dataOrResponse === 'object') {
    // If it's an object (API response), extract data and timezone_offset
    data = getWeatherDataArray(dataOrResponse);
    timezoneOffset = dataOrResponse?.timezone_offset || 0;
    console.log('updateHourlyForecast: dataOrResponse is object, data length:', data.length, 'timezoneOffset:', timezoneOffset);
  } else {
    console.error('updateHourlyForecast: invalid dataOrResponse:', dataOrResponse);
    container.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">No forecast data available</div>';
    return;
  }

  if (!data || data.length === 0) {
    console.warn('updateHourlyForecast: no data available');
    container.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">No forecast data available</div>';
    return;
  }

  // Process data based on period
  const displayData = processDataForPeriod(data, period, timezoneOffset);
  console.log('updateHourlyForecast: displayData length after processing:', displayData.length, 'period:', period);

  if (displayData.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">No forecast data available</div>';
    return;
  }

  // Clear container without removing drag-scroll handlers
  // Use removeChild instead of innerHTML to preserve event listeners
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Calculate responsive sizes
  const sizes = getResponsiveSizes(displayData.length);

  displayData.forEach((item) => {
    const clone = template.content.cloneNode(true);
    const cardEl = clone.firstElementChild;

    if (!cardEl) return;

    // Apply fixed styles for consistent card sizes
    cardEl.className = `flex flex-col items-center bg-dark-bg-card rounded-lg p-3 card-hover fade-in`;
    cardEl.style.width = '120px';
    cardEl.style.minWidth = '120px';
    cardEl.style.maxWidth = '120px';
    cardEl.style.minHeight = '340px';
    cardEl.style.maxHeight = '340px';
    cardEl.style.flexShrink = '0';
    cardEl.style.justifyContent = 'space-between';

    // Time/Date label - minimal margin
    const timeEl = clone.getElementById('hourly-time');
    if (timeEl) {
      timeEl.className = `${sizes.timeFont} text-dark-text-secondary mb-0.5 font-medium`;
      timeEl.textContent = formatTimeLabel(item, period, timezoneOffset);
    }

    // Icon - smaller size to reduce empty space
    const iconEl = clone.getElementById('hourly-icon');
    if (iconEl && item.description) {
      const icon = getWeatherIcon(item.description, 'small');
      // Use smaller icon size
      applySizeToIcon(icon, 'w-8 h-8 sm:w-9 sm:h-9');
      iconEl.innerHTML = '';
      iconEl.appendChild(icon);
      iconEl.style.width = '40px';
      iconEl.style.height = '40px';
      iconEl.style.marginBottom = '0.5rem';
    }

    // Temperature - smaller size with minimal margin
    const tempEl = clone.getElementById('hourly-temp');
    if (tempEl && item.temp !== undefined) {
      tempEl.className = `text-base sm:text-lg md:text-xl font-bold`;
      tempEl.textContent = formatTemperature(item.temp);
      tempEl.style.marginBottom = '0.5rem';
    }

    // Min/Max temperature (if available) - always show if data exists
    const tempRangeEl = clone.getElementById('hourly-temp-range');
    if (tempRangeEl) {
      if (item.temp_min !== null && item.temp_min !== undefined &&
          item.temp_max !== null && item.temp_max !== undefined) {
        tempRangeEl.classList.remove('hidden');
        tempRangeEl.textContent = `${formatTemperature(item.temp_min)} / ${formatTemperature(item.temp_max)}`;
        tempRangeEl.style.marginBottom = '0';
      } else {
        tempRangeEl.classList.add('hidden');
      }
    }

    // Details - shows only fields with data
    updateForecastDetails(clone, item, sizes.detailFont);

    container.appendChild(clone);
  });

  // Re-initialize drag-to-scroll after updating forecast (only if not already initialized)
  // Use requestAnimationFrame to ensure DOM is updated
  requestAnimationFrame(() => {
    initDragToScroll();
  });
}

/**
 * Process data for specific period display
 * @param {Array} data - Raw weather data
 * @param {string} period - Display period
 * @returns {Array} Processed data
 */
function processDataForPeriod(data, period, timezoneOffset = 0) {
  switch (period) {
    case 'today':
    case 'tomorrow':
      // API already returns filtered data for 3-hour intervals [2AM, 5AM, 8AM, 11AM, 2PM, 5PM, 8PM, 11PM]
      // Just return all data as-is, sorted by timestamp
      return data.sort((a, b) => {
        const dtA = typeof a.dt === 'number' ? a.dt : (a.dt ? new Date(a.dt).getTime() / 1000 : 0);
        const dtB = typeof b.dt === 'number' ? b.dt : (b.dt ? new Date(b.dt).getTime() / 1000 : 0);
        return dtA - dtB;
      });

    case '3days':
      // Backend already returns 3 days, just add _displayDate for each item and sort
      return data.map((item) => {
        const itemDate = getItemDate(item);
        if (itemDate) {
          // Apply timezone offset to get local date
          const localDate = new Date(itemDate.getTime() + timezoneOffset * 1000);
          const displayDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
          return {
            ...item,
            _displayDate: displayDate,
          };
        }
        return item;
      }).sort((a, b) => {
        const dtA = typeof a.dt === 'number' ? a.dt : (a.dt ? new Date(a.dt).getTime() / 1000 : 0);
        const dtB = typeof b.dt === 'number' ? b.dt : (b.dt ? new Date(b.dt).getTime() / 1000 : 0);
        return dtA - dtB;
      });

    case 'week':
      // Backend already returns 7 days, just add _displayDate for each item and sort
      return data.map((item) => {
        const itemDate = getItemDate(item);
        if (itemDate) {
          // Apply timezone offset to get local date
          const localDate = new Date(itemDate.getTime() + timezoneOffset * 1000);
          const displayDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
          return {
            ...item,
            _displayDate: displayDate,
          };
        }
        return item;
      }).sort((a, b) => {
        const dtA = typeof a.dt === 'number' ? a.dt : (a.dt ? new Date(a.dt).getTime() / 1000 : 0);
        const dtB = typeof b.dt === 'number' ? b.dt : (b.dt ? new Date(b.dt).getTime() / 1000 : 0);
        return dtA - dtB;
      });


    case 'hourly':
      return data.slice(0, 12);

    default:
      return data.slice(0, 24);
  }
}

/**
 * Filter data by day offset
 * @param {Array} data - Weather data
 * @param {number} dayOffset - 0 for today, 1 for tomorrow
 * @returns {Array} Filtered data
 */
function filterByDay(data, dayOffset) {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);

  return data.filter((item) => {
    const itemDate = getItemDate(item);
    if (!itemDate) return false;

    const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    return itemDay.getTime() === targetDate.getTime();
  });
}

/**
 * Group data by day periods (Morning, Day, Evening, Night)
 * @param {Array} data - Weather data
 * @param {number} days - Number of days
 * @returns {Array} Grouped data
 */
function groupByDayPeriods(data, days) {
  const result = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let d = 0; d < days; d++) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + d);

    const dayData = data.filter((item) => {
      const itemDate = getItemDate(item);
      if (!itemDate) return false;
      const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      return itemDay.getTime() === targetDate.getTime();
    });

    // Get representative item for the day (noon or first available)
    const representative = dayData.find((item) => {
      const itemDate = getItemDate(item);
      return itemDate && itemDate.getHours() >= 11 && itemDate.getHours() <= 14;
    }) || dayData[0];

    if (representative) {
      result.push({
        ...representative,
        _displayDate: targetDate,
      });
    }
  }

  return result;
}

/**
 * Get one entry per day
 * @param {Array} data - Weather data
 * @param {number} days - Number of days
 * @returns {Array} One entry per day
 */
function getOneDayPerEntry(data, days, timezoneOffset = 0) {
  const dayMap = new Map();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  data.forEach((item) => {
    const itemDate = getItemDate(item);
    if (!itemDate) return;

    // Apply timezone offset to get local date
    const localDate = new Date(itemDate.getTime() + timezoneOffset * 1000);
    const itemDay = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
    const dayKey = `${itemDay.getFullYear()}-${itemDay.getMonth()}-${itemDay.getDate()}`;
    const daysDiff = Math.floor((itemDay - today) / (24 * 60 * 60 * 1000));

    if (daysDiff >= 0 && daysDiff < days && !dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        ...item,
        _displayDate: itemDay,
      });
    }
  });

  return Array.from(dayMap.values())
    .sort((a, b) => a._displayDate - b._displayDate)
    .slice(0, days);
}

/**
 * Get Date object from weather item
 * @param {Object} item - Weather item
 * @returns {Date|null} Date object
 */
function getItemDate(item) {
  if (!item.dt) return null;

  if (typeof item.dt === 'string') {
    return new Date(item.dt);
  }
  if (typeof item.dt === 'number') {
    return new Date(item.dt * 1000);
  }
  return null;
}

/**
 * Format time label for forecast item
 * @param {Object} item - Weather item
 * @param {string} period - Display period
 * @param {number} [timezoneOffset=0] - Timezone offset in seconds
 * @returns {string} Formatted label
 */
function formatTimeLabel(item, period, timezoneOffset = 0) {
  const date = item._displayDate || getItemDate(item);
  if (!date) return '--';

  if (['week', '3days'].includes(period)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]}`;
  }

  // Use timestamp directly with timezone offset
  const timestamp = item.dt || (date instanceof Date ? date.getTime() / 1000 : date);
  return formatTime(timestamp, timezoneOffset);
}

/**
 * Get responsive sizes based on card count
 * @param {number} cardCount - Number of cards
 * @returns {Object} Size configuration
 */
function getResponsiveSizes(cardCount) {
  if (cardCount <= 8) {
    return {
      timeFont: 'text-sm',
      tempFont: 'text-xl sm:text-2xl',
      detailFont: 'text-[10px] sm:text-xs',
      iconSize: 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8',
      padding: 'p-3 sm:p-4',
    };
  } else if (cardCount <= 12) {
    return {
      timeFont: 'text-xs sm:text-sm',
      tempFont: 'text-lg sm:text-xl',
      detailFont: 'text-[9px] sm:text-[10px]',
      iconSize: 'w-5 h-5 sm:w-6 sm:h-6',
      padding: 'p-2 sm:p-3',
    };
  }
  return {
    timeFont: 'text-[10px] sm:text-xs',
    tempFont: 'text-base sm:text-lg',
    detailFont: 'text-[8px] sm:text-[9px]',
    iconSize: 'w-4 h-4 sm:w-5 sm:h-5',
    padding: 'p-2',
  };
}

/**
 * Apply size class to icon element
 * @param {Element} icon - Icon element
 * @param {string} sizeClass - Size class string
 */
function applySizeToIcon(icon, sizeClass) {
  if (!icon) return;

  const svg = icon.tagName === 'svg' ? icon : icon.querySelector('svg');
  if (svg) {
    const currentClass = svg.getAttribute('class') || '';
    const newClass = currentClass.replace(/w-\d+ h-\d+/g, '').trim() + ' ' + sizeClass;
    svg.setAttribute('class', newClass.trim());
  }
}

/**
 * Update forecast card details section
 * Shows only fields that have data (not null/undefined)
 * @param {DocumentFragment} clone - Template clone
 * @param {Object} item - Weather item
 * @param {string} fontSize - Font size class
 */
function updateForecastDetails(clone, item, fontSize) {
  // Helper to show/hide row based on data availability
  const toggleRow = (rowId, iconElId, valueElId, parameter, value, formatter = (v) => v) => {
    const row = clone.getElementById(rowId);
    const iconEl = clone.getElementById(iconElId);
    const valueEl = clone.getElementById(valueElId);

    if (row && valueEl) {
      if (value !== null && value !== undefined) {
        row.classList.remove('hidden');
        valueEl.className = `font-semibold ${fontSize}`;
        valueEl.textContent = formatter(value);

        // Add tooltip (title attribute)
        row.setAttribute('title', getParameterName(parameter));
        valueEl.setAttribute('title', getParameterName(parameter));

        // Insert icon
        if (iconEl) {
          iconEl.innerHTML = '';
          const icon = getParameterIcon(parameter, 'small');
          iconEl.appendChild(icon);
        }
      } else {
        row.classList.add('hidden');
      }
    }
  };

  // Real Feel (feels_like)
  toggleRow('hourly-feels-like-row', 'hourly-feels-like-icon', 'hourly-feels-like', 'feels-like', item.feels_like, (v) => formatTemperature(v));

  // Humidity
  toggleRow('hourly-humidity-row', 'hourly-humidity-icon', 'hourly-humidity', 'humidity', item.humidity, (v) => `${v}%`);

  // Pressure
  toggleRow('hourly-pressure-row', 'hourly-pressure-icon', 'hourly-pressure', 'pressure', item.pressure, (v) => `${v} hPa`);

  // Wind Speed
  toggleRow('hourly-wind-row', 'hourly-wind-icon', 'hourly-wind', 'wind', item.wind_speed, (v) => `${v} km/h`);

  // Wind Direction (wind_deg)
  toggleRow('hourly-wind-deg-row', 'hourly-wind-deg-icon', 'hourly-wind-deg', 'wind-deg', item.wind_deg, (v) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(v / 22.5) % 16;
    return `${directions[index]} (${v}°)`;
  });

  // Visibility
  toggleRow('hourly-visibility-row', 'hourly-visibility-icon', 'hourly-visibility', 'visibility', item.visibility, (v) => {
    if (v >= 1000) {
      return `${(v / 1000).toFixed(1)} km`;
    }
    return `${v} m`;
  });

  // Clouds
  toggleRow('hourly-clouds-row', 'hourly-clouds-icon', 'hourly-clouds', 'clouds', item.clouds, (v) => `${v}%`);

  // UV Index
  toggleRow('hourly-uvi-row', 'hourly-uvi-icon', 'hourly-uvi', 'uvi', item.uvi, (v) => v.toString());

  // Precipitation Probability (pop)
  toggleRow('hourly-pop-row', 'hourly-pop-icon', 'hourly-pop', 'precipitation', item.pop, (v) => `${Math.round(v * 100)}%`);

  // Rain (if available)
  toggleRow('hourly-rain-row', 'hourly-rain-icon', 'hourly-rain', 'rain', item.rain, (v) => {
    if (typeof v === 'object' && v['1h']) {
      return `${v['1h']} mm`;
    }
    return `${v} mm`;
  });

  // Snow (if available)
  toggleRow('hourly-snow-row', 'hourly-snow-icon', 'hourly-snow', 'snow', item.snow, (v) => {
    if (typeof v === 'object' && v['1h']) {
      return `${v['1h']} mm`;
    }
    return `${v} mm`;
  });
}

/**
 * Clear weather cache for a city
 * @param {number} cityId - City ID (optional, clears all if not provided)
 */
export function clearWeatherCache(cityId = null) {
  if (cityId) {
    VALID_PERIODS.forEach((period) => {
      cache.delete(Cache.weatherKey(cityId, period));
    });
  } else {
    cache.clear();
  }
}

// Import VALID_PERIODS for clearWeatherCache
import { VALID_PERIODS } from './config.js';
