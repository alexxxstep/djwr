/**
 * Weather icons system
 */

/**
 * Get weather icon based on condition and size
 */
export function getWeatherIcon(condition, size = 'medium') {
  const sizeMap = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-32 h-32',
  };

  const sizeClass = sizeMap[size] || sizeMap.medium;
  const iconData = getIconData(condition);

  return createIconSVG(iconData, sizeClass);
}

/**
 * Get icon data based on weather condition
 * Supports OpenWeatherMap description strings
 */
function getIconData(condition) {
  const conditionLower = (condition || '').toLowerCase();

  // Clear sky / Sunny
  if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
    return {
      type: 'sun',
      color: 'text-accent-yellow',
      fill: 'fill-accent-yellow',
    };
  }

  // Rain / Drizzle
  if (conditionLower.includes('rain') || conditionLower.includes('drizzle') || conditionLower.includes('shower')) {
    return {
      type: 'rain',
      color: 'text-accent-blue',
      fill: 'fill-accent-blue',
    };
  }

  // Storm / Thunder
  if (conditionLower.includes('storm') || conditionLower.includes('thunder')) {
    return {
      type: 'storm',
      color: 'text-accent-yellow',
      fill: 'fill-accent-yellow',
    };
  }

  // Snow
  if (conditionLower.includes('snow') || conditionLower.includes('sleet')) {
    return {
      type: 'snow',
      color: 'text-dark-text-primary',
      fill: 'fill-dark-text-primary',
    };
  }

  // Mist / Fog / Haze
  if (conditionLower.includes('mist') || conditionLower.includes('fog') || conditionLower.includes('haze') || conditionLower.includes('smoke')) {
    return {
      type: 'mist',
      color: 'text-dark-text-secondary',
      fill: 'fill-dark-text-secondary',
    };
  }

  // Clouds (overcast, broken, scattered, few)
  if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
    return {
      type: 'cloud',
      color: 'text-dark-text-primary',
      fill: 'fill-dark-text-primary',
    };
  }

  // Default: cloud
  return {
    type: 'cloud',
    color: 'text-dark-text-primary',
    fill: 'fill-dark-text-primary',
  };
}

/**
 * Create SVG icon element
 */
function createIconSVG(iconData, sizeClass) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `${sizeClass} ${iconData.color}`);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');

  const path = getIconPath(iconData.type);
  svg.innerHTML = path;

  return svg;
}

/**
 * Get SVG path for icon type
 */
function getIconPath(type) {
  const paths = {
    sun: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />',
    cloud: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />',
    rain: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 19l-2-2m4 0l-2 2m6 0l-2-2m4 0l-2 2" />',
    storm: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />',
    snow: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l.607.607M7 17l-.607.607m.607-.607L7 19m.607-1.393L9 17m-1.393.607L7 15m.607 1.393L5 17m2.607.607L7 19" />',
    mist: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 12h16M4 16h12" />',
  };

  return paths[type] || paths.cloud;
}

/**
 * Format temperature with unit
 */
export function formatTemperature(temp, unit = '°C') {
  if (temp === null || temp === undefined) return '--';
  return `${Math.round(temp)}${unit}`;
}

/**
 * Format time from timestamp or date string
 * @param {number|string|Date} timestamp - Timestamp (Unix seconds, milliseconds, or Date object)
 * @param {number} [timezoneOffset=0] - Timezone offset in seconds (optional)
 * @returns {string} Formatted time string
 */
export function formatTime(timestamp, timezoneOffset = 0) {
  if (!timestamp) return '';

  let date;
  if (timestamp instanceof Date) {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    // If timestamp is in seconds (Unix timestamp), convert to milliseconds
    if (timestamp < 10000000000) {
      date = new Date(timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }
  } else {
    date = new Date(timestamp);
  }

  // Apply timezone offset (convert from UTC to local time of city)
  // timezoneOffset is in seconds, so convert to milliseconds
  // The timestamp from API is in UTC, we need to add the city's timezone offset
  const offsetMs = timezoneOffset * 1000;
  // Create a new date with the offset applied
  // Since Date objects are in local browser time, we need to work with UTC
  const utcTime = date.getTime();
  const localTime = utcTime + offsetMs;
  const localDate = new Date(localTime);

  // Use UTC methods to get the correct hours/minutes after applying offset
  const hours = localDate.getUTCHours();
  const minutes = localDate.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Format date
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[date.getDay()];
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${dayName} ${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Get parameter icon (for weather conditions)
 * @param {string} parameter - Parameter name
 * @param {string} size - Icon size ('small' | 'medium' | 'large')
 * @returns {SVGElement} SVG icon element
 */
export function getParameterIcon(parameter, size = 'small') {
  const sizeMap = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6',
  };

  const sizeClass = sizeMap[size] || sizeMap.small;
  const iconData = getParameterIconData(parameter);

  return createParameterIconSVG(iconData, sizeClass);
}

/**
 * Get icon data for parameter
 */
function getParameterIconData(parameter) {
  const paramLower = (parameter || '').toLowerCase();

  const iconMap = {
    'feels-like': { type: 'thermometer', color: 'text-accent-orange' },
    'real-feel': { type: 'thermometer', color: 'text-accent-orange' },
    'humidity': { type: 'droplet', color: 'text-accent-blue' },
    'pressure': { type: 'gauge', color: 'text-dark-text-primary' },
    'wind': { type: 'wind', color: 'text-accent-blue' },
    'wind-deg': { type: 'compass', color: 'text-accent-blue' },
    'wind-direction': { type: 'compass', color: 'text-accent-blue' },
    'visibility': { type: 'eye', color: 'text-dark-text-secondary' },
    'clouds': { type: 'cloud', color: 'text-dark-text-primary' },
    'uvi': { type: 'sun', color: 'text-accent-yellow' },
    'uv-index': { type: 'sun', color: 'text-accent-yellow' },
    'pop': { type: 'droplet', color: 'text-accent-blue' },
    'precipitation': { type: 'droplet', color: 'text-accent-blue' },
    'rain': { type: 'rain', color: 'text-accent-blue' },
    'snow': { type: 'snow', color: 'text-dark-text-primary' },
  };

  // Try exact match first
  if (iconMap[paramLower]) {
    return iconMap[paramLower];
  }

  // Try partial match
  for (const [key, value] of Object.entries(iconMap)) {
    if (paramLower.includes(key) || key.includes(paramLower)) {
      return value;
    }
  }

  // Default
  return { type: 'info', color: 'text-dark-text-secondary' };
}

/**
 * Create parameter icon SVG
 */
function createParameterIconSVG(iconData, sizeClass) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `${sizeClass} ${iconData.color} flex-shrink-0`);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('stroke-width', '2');

  const path = getParameterIconPath(iconData.type);
  svg.innerHTML = path;

  return svg;
}

/**
 * Get SVG path for parameter icon type
 */
function getParameterIconPath(type) {
  const paths = {
    thermometer: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
    droplet: '<path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />',
    gauge: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
    wind: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />',
    compass: '<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />',
    eye: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />',
    cloud: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />',
    sun: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />',
    rain: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path stroke-linecap="round" stroke-linejoin="round" d="M7 19l-2-2m4 0l-2 2m6 0l-2-2m4 0l-2 2" />',
    snow: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path stroke-linecap="round" stroke-linejoin="round" d="M7 17l.607.607M7 17l-.607.607m.607-.607L7 19m.607-1.393L9 17m-1.393.607L7 15m.607 1.393L5 17m2.607.607L7 19" />',
    info: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
  };

  return paths[type] || paths.info;
}

