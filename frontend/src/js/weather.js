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
  if (!container || !weatherData) {
    return;
  }

  const template = document.getElementById('weather-card-template');
  if (!template) {
    return;
  }

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

  // Update air conditions info
  const feelsLikeEl = clone.getElementById('weather-feels-like');
  if (feelsLikeEl && weatherData.feels_like !== undefined) {
    feelsLikeEl.textContent = formatTemperature(weatherData.feels_like);
  }

  const rainEl = clone.getElementById('weather-rain');
  if (rainEl) {
    const pop = weatherData.pop || weatherData.rain_probability || 0;
    rainEl.textContent = `${Math.round(pop * 100)}%`;
  }

  const windEl = clone.getElementById('weather-wind');
  if (windEl && weatherData.wind_speed !== undefined) {
    windEl.textContent = `${weatherData.wind_speed} km/h`;
  }

  const uvEl = clone.getElementById('weather-uv');
  if (uvEl) {
    uvEl.textContent = weatherData.uvi || weatherData.uv_index || '--';
  }

  container.innerHTML = '';
  container.appendChild(clone);
}

/**
 * Filter hourly data to show every 3 hours (2 AM, 5 AM, 8 AM, ..., 11 PM)
 * @param {Array} hourlyData - Array of hourly forecast items
 * @param {string} period - 'today' or 'tomorrow'
 */
function filterEvery3Hours(hourlyData, period = 'today') {
  if (!Array.isArray(hourlyData) || hourlyData.length === 0) {
    return [];
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filtered = [];
  const targetHours = [2, 5, 8, 11, 14, 17, 20, 23]; // Every 3 hours starting from 2 AM

  hourlyData.forEach((item) => {
    let timestamp;
    if (typeof item.dt === 'string') {
      timestamp = new Date(item.dt).getTime();
    } else if (typeof item.dt === 'number') {
      timestamp = item.dt * 1000;
    } else {
      return;
    }

    const date = new Date(timestamp);
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const hours = date.getHours();

    // Filter by date based on period
    if (period === 'tomorrow') {
      // Only include items from tomorrow
      if (itemDate.getTime() !== tomorrow.getTime()) {
        return;
      }
    } else {
      // For 'today', include items from today
      if (itemDate.getTime() !== today.getTime()) {
        return;
      }
    }

    // Filter: 2, 5, 8, 11, 14, 17, 20, 23 (every 3 hours starting from 2 AM)
    if (targetHours.includes(hours)) {
      filtered.push(item);
    }
  });

  // For 'today', ensure we have all hours from 2 AM to 11 PM
  // API may not return past hours, so we need to handle missing data
  if (period === 'today') {
    // Sort by timestamp
    filtered.sort((a, b) => {
      const tsA = typeof a.dt === 'number' ? a.dt * 1000 : new Date(a.dt).getTime();
      const tsB = typeof b.dt === 'number' ? b.dt * 1000 : new Date(b.dt).getTime();
      return tsA - tsB;
    });

    // Create a map of hours we have
    const hoursMap = new Map();
    filtered.forEach((item) => {
      let timestamp;
      if (typeof item.dt === 'string') {
        timestamp = new Date(item.dt).getTime();
      } else if (typeof item.dt === 'number') {
        timestamp = item.dt * 1000;
      } else {
        return;
      }
      const date = new Date(timestamp);
      const hours = date.getHours();
      hoursMap.set(hours, item);
    });

    // Build result array with all target hours (2, 5, 8, 11, 14, 17, 20, 23)
    // For missing past hours, use the earliest available data
    const result = [];
    const currentHour = now.getHours();
    let earliestItem = filtered.length > 0 ? filtered[0] : null;

    targetHours.forEach((targetHour) => {
      if (hoursMap.has(targetHour)) {
        // We have data for this hour
        result.push(hoursMap.get(targetHour));
      } else if (targetHour < currentHour && earliestItem) {
        // Past hour is missing - use earliest available data as fallback
        // This handles cases where API doesn't return historical data
        const fallbackItem = { ...earliestItem };
        // Update timestamp to match the target hour
        const targetDate = new Date(today);
        targetDate.setHours(targetHour, 0, 0, 0);
        fallbackItem.dt = Math.floor(targetDate.getTime() / 1000);
        result.push(fallbackItem);
      } else if (targetHour >= currentHour) {
        // Future hour is missing - find closest future hour
        let closestItem = null;
        let minDiff = Infinity;
        filtered.forEach((item) => {
          let timestamp;
          if (typeof item.dt === 'string') {
            timestamp = new Date(item.dt).getTime();
          } else if (typeof item.dt === 'number') {
            timestamp = item.dt * 1000;
          } else {
            return;
          }
          const date = new Date(timestamp);
          const itemHour = date.getHours();
          if (itemHour >= targetHour) {
            const diff = itemHour - targetHour;
            if (diff < minDiff) {
              minDiff = diff;
              closestItem = item;
            }
          }
        });
        if (closestItem) {
          result.push(closestItem);
        }
      }
    });

    return result;
  }

  return filtered;
}

/**
 * Group forecast data by day and time periods (Night, Morning, Day, Evening)
 * Returns data for next 3 days
 */
function groupByDayPeriods(forecastData) {
  if (!Array.isArray(forecastData) || forecastData.length === 0) {
    return [];
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day2 = new Date(tomorrow);
  day2.setDate(day2.getDate() + 1);
  const day3 = new Date(day2);
  day3.setDate(day3.getDate() + 1);

  // Include today, tomorrow, and day after tomorrow (3 days total)
  const targetDays = [today, tomorrow, day2];
  const grouped = [];
  const dayMap = new Map();

  forecastData.forEach((item) => {
    let timestamp;
    if (typeof item.dt === 'string') {
      timestamp = new Date(item.dt).getTime();
    } else if (typeof item.dt === 'number') {
      timestamp = item.dt * 1000;
    } else {
      return;
    }

    const date = new Date(timestamp);
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const hours = date.getHours();

    // Include items from today, tomorrow, and day after tomorrow (3 days total)
    const isTargetDay = targetDays.some(
      (targetDay) => itemDate.getTime() === targetDay.getTime()
    );
    if (!isTargetDay) {
      return;
    }

    const dateKey = itemDate.toDateString();

    // Determine period: Night (0-5), Morning (6-11), Day (12-17), Evening (18-23)
    let period;
    if (hours >= 0 && hours < 6) {
      period = 'Night';
    } else if (hours >= 6 && hours < 12) {
      period = 'Morning';
    } else if (hours >= 12 && hours < 18) {
      period = 'Day';
    } else {
      period = 'Evening';
    }

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        date: itemDate, // Store as Date object
        periods: {},
      });
    }

    const dayData = dayMap.get(dateKey);
    if (!dayData.periods[period]) {
      dayData.periods[period] = [];
    }
    dayData.periods[period].push(item);
  });

  // Convert to array and get representative item for each period
  // Sort days to ensure correct order
  const sortedDays = Array.from(dayMap.entries()).sort((a, b) => {
    return a[1].date.getTime() - b[1].date.getTime();
  });

  sortedDays.forEach(([dateKey, dayData]) => {
    const periods = ['Night', 'Morning', 'Day', 'Evening'];
    periods.forEach((period) => {
      if (dayData.periods[period] && dayData.periods[period].length > 0) {
        const items = dayData.periods[period];
        // Get the middle item as representative
        const middleIndex = Math.floor(items.length / 2);
        const representative = items[middleIndex];
        grouped.push({
          date: dayData.date,
          period: period,
          dt: representative.dt, // Keep original timestamp for icon/weather
          temp: representative.temp !== undefined ? representative.temp : representative.temperature,
          temperature: representative.temp !== undefined ? representative.temp : representative.temperature,
          feels_like: representative.feels_like,
          humidity: representative.humidity,
          pressure: representative.pressure,
          wind_speed: representative.wind_speed,
          wind_deg: representative.wind_deg,
          visibility: representative.visibility,
          clouds: representative.clouds,
          description: representative.description,
          icon: representative.icon,
          weather: representative.weather || (representative.description ? [{ description: representative.description }] : []),
        });
      }
    });
  });

  return grouped;
}

/**
 * Update hourly forecast display
 */
export function updateHourlyForecast(
  hourlyData,
  period = 'today',
  containerId = 'hourly-forecast-container'
) {
  const container = document.getElementById(containerId);
  if (!container || !hourlyData) {
    return;
  }

  const template = document.getElementById('hourly-item-template');
  if (!template) {
    return;
  }

  container.innerHTML = '';

  let displayData = [];

  if (period === 'today' || period === 'tomorrow') {
    // Filter to show every 3 hours
    if (Array.isArray(hourlyData)) {
      displayData = filterEvery3Hours(hourlyData, period);
    }
  } else if (period === '3days') {
    // Group by day periods (Night, Morning, Day, Evening)
    if (Array.isArray(hourlyData)) {
      displayData = groupByDayPeriods(hourlyData);
    }
  } else if (period === 'week') {
    // Show 7 days starting from today - get one item per day
    if (Array.isArray(hourlyData)) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDays = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(day.getDate() + i);
        targetDays.push(day);
      }

      const dayMap = new Map();
      hourlyData.forEach((item) => {
        let timestamp;
        if (typeof item.dt === 'string') {
          timestamp = new Date(item.dt).getTime();
        } else if (typeof item.dt === 'number') {
          timestamp = item.dt * 1000;
        } else {
          return;
        }

        const date = new Date(timestamp);
        const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        // Only include items from the next 7 days starting from today
        const isTargetDay = targetDays.some(
          (targetDay) => itemDate.getTime() === targetDay.getTime()
        );
        if (!isTargetDay) {
          return;
        }

        const dateKey = itemDate.toDateString();

        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, item);
        }
      });

      // Sort by date to ensure correct order
      const sortedEntries = Array.from(dayMap.entries()).sort((a, b) => {
        const dateA = new Date(a[0]);
        const dateB = new Date(b[0]);
        return dateA.getTime() - dateB.getTime();
      });

      displayData = sortedEntries.map(([dateKey, item]) => item).slice(0, 7);
    }
  } else {
    // Default: show all hourly data
    displayData = Array.isArray(hourlyData) ? hourlyData.slice(0, 24) : [];
  }

  if (displayData.length === 0) {
    container.innerHTML =
      '<div class="text-center py-8 text-dark-text-secondary text-sm">No forecast data available</div>';
    return;
  }

  // Calculate responsive font sizes based on number of cards
  const cardCount = displayData.length;
  let timeFontSize = 'text-xs';
  let tempFontSize = 'text-lg';
  let detailFontSize = 'text-[9px]';
  let iconSize = 'w-5 h-5';
  let paddingSize = 'p-2';

  if (cardCount <= 7) {
    // Week: 7 cards - larger
    timeFontSize = 'text-sm';
    tempFontSize = 'text-xl sm:text-2xl';
    detailFontSize = 'text-[10px] sm:text-xs';
    iconSize = 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8';
    paddingSize = 'p-3 sm:p-4';
  } else if (cardCount <= 12) {
    // 3 Days: 12 cards - medium
    timeFontSize = 'text-xs sm:text-sm';
    tempFontSize = 'text-lg sm:text-xl';
    detailFontSize = 'text-[9px] sm:text-[10px]';
    iconSize = 'w-5 h-5 sm:w-6 sm:h-6';
    paddingSize = 'p-2 sm:p-3';
  } else {
    // Today/Tomorrow: 8 cards - smaller
    timeFontSize = 'text-[10px] sm:text-xs';
    tempFontSize = 'text-base sm:text-lg';
    detailFontSize = 'text-[8px] sm:text-[9px]';
    iconSize = 'w-4 h-4 sm:w-5 sm:h-5';
    paddingSize = 'p-2';
  }

  displayData.forEach((item, index) => {
    const clone = template.content.cloneNode(true);

    // Find the root card element - it's the first element child (the div card container)
    const cardEl = clone.firstElementChild;
    if (!cardEl || cardEl.tagName !== 'DIV') {
      return;
    }
    // Update card classes
    cardEl.className = `flex flex-col items-center bg-dark-bg-card rounded-lg ${paddingSize} flex-1 min-w-0 card-hover fade-in`;

    const timeEl = clone.getElementById('hourly-time');
    if (timeEl) {
      // Apply responsive font size
      timeEl.className = `${timeFontSize} text-dark-text-secondary mb-2 sm:mb-3 font-medium`;

      if (period === '3days' && item.period && item.date) {
        // For 3 days view, show day name and date (same format as Week), without period name
        // item.date is already a Date object from groupByDayPeriods
        const date = item.date instanceof Date ? item.date : new Date(item.date);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayName = dayNames[date.getDay()];
        timeEl.textContent = `${dayName}, ${date.getDate()} ${monthNames[date.getMonth()]}`;
      } else if (period === 'week' && item.dt) {
        // For week view, show day name and date
        let timestamp;
        if (typeof item.dt === 'string') {
          timestamp = new Date(item.dt).getTime();
        } else if (typeof item.dt === 'number') {
          timestamp = item.dt * 1000;
        } else {
          timestamp = Date.now();
        }
        const date = new Date(timestamp);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        timeEl.textContent = `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]}`;
      } else if (item.dt) {
        // For today/tomorrow, show time
        let timestamp;
        if (typeof item.dt === 'string') {
          timestamp = new Date(item.dt).getTime();
        } else if (typeof item.dt === 'number') {
          timestamp = item.dt * 1000;
        } else {
          timestamp = Date.now();
        }
        timeEl.textContent = formatTime(timestamp);
      }
    }

    const iconEl = clone.getElementById('hourly-icon');
    if (iconEl) {
      let weatherDesc = '';
      if (item.weather && item.weather[0]) {
        weatherDesc = item.weather[0].description;
      } else if (item.description) {
        weatherDesc = item.description;
      }

      if (weatherDesc) {
        // Create icon with responsive size
        const icon = getWeatherIcon(weatherDesc, 'small');
        // Replace size classes with responsive size
        if (icon.tagName === 'svg') {
          // For SVG elements, use setAttribute instead of className assignment
          const currentClassName = icon.className?.baseVal || icon.getAttribute('class') || '';
          const classNameStr = typeof currentClassName === 'string' ? currentClassName : String(currentClassName);
          const newClassName = classNameStr.replace(/w-\d+ h-\d+/g, '').trim() + ' ' + iconSize;
          icon.setAttribute('class', newClassName.trim());
        } else {
          const svg = icon.querySelector('svg');
          if (svg) {
            // For SVG elements, use setAttribute instead of className assignment
            const currentClassName = svg.className?.baseVal || svg.getAttribute('class') || '';
            const classNameStr = typeof currentClassName === 'string' ? currentClassName : String(currentClassName);
            const newClassName = classNameStr.replace(/w-\d+ h-\d+/g, '').trim() + ' ' + iconSize;
            svg.setAttribute('class', newClassName.trim());
          }
        }
        iconEl.innerHTML = '';
        iconEl.appendChild(icon);
      }
    }

    const tempEl = clone.getElementById('hourly-temp');
    if (tempEl) {
      // Apply responsive font size
      tempEl.className = `${tempFontSize} font-bold mb-3 sm:mb-4`;
      // Handle both 'temp' and 'temperature' fields
      const temp = item.temp !== undefined ? item.temp : item.temperature;
      if (temp !== undefined) {
        tempEl.textContent = formatTemperature(temp);
      }
    }

    // Update additional weather info with responsive font sizes
    // Find the details container by looking for the div containing hourly-feels-like
    const feelsLikeEl = clone.getElementById('hourly-feels-like');
    const detailsContainer = feelsLikeEl ? feelsLikeEl.closest('div[class*="space-y"]') : null;
    if (detailsContainer) {
      detailsContainer.className = `w-full space-y-1 sm:space-y-1.5 pt-2 sm:pt-3 border-t border-dark-bg-secondary`;
    }

    if (feelsLikeEl) {
      feelsLikeEl.className = `font-semibold ${detailFontSize}`;
      const feelsLike = item.feels_like !== undefined ? item.feels_like : item.temp;
      if (feelsLike !== undefined) {
        feelsLikeEl.textContent = formatTemperature(feelsLike);
      }
    }

    const rainEl = clone.getElementById('hourly-rain');
    if (rainEl) {
      rainEl.className = `font-semibold ${detailFontSize}`;
      const pop = item.pop !== undefined ? item.pop : (item.rain_probability || 0);
      rainEl.textContent = `${Math.round(pop * 100)}%`;
    }

    const windEl = clone.getElementById('hourly-wind');
    if (windEl) {
      windEl.className = `font-semibold ${detailFontSize}`;
      const windSpeed = item.wind_speed !== undefined ? item.wind_speed : 0;
      windEl.textContent = `${windSpeed} km/h`;
    }

    // Update detail labels
    const detailLabels = clone.querySelectorAll('.text-dark-text-secondary');
    detailLabels.forEach((label) => {
      if (label.textContent === 'Real Feel' || label.textContent === 'Precipitation' || label.textContent === 'Wind') {
        label.className = `text-dark-text-secondary ${detailFontSize}`;
      }
    });

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
      label: 'Chance of precipitation',
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

