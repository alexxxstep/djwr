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
 */
function getIconData(condition) {
  const conditionLower = (condition || '').toLowerCase();

  // Map OpenWeatherMap icon codes and descriptions to our icons
  if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
    return {
      type: 'sun',
      color: 'text-accent-yellow',
      fill: 'fill-accent-yellow',
    };
  }

  if (conditionLower.includes('cloud') && !conditionLower.includes('rain')) {
    return {
      type: 'cloud',
      color: 'text-dark-text-primary',
      fill: 'fill-dark-text-primary',
    };
  }

  if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
    return {
      type: 'rain',
      color: 'text-accent-blue',
      fill: 'fill-accent-blue',
    };
  }

  if (conditionLower.includes('storm') || conditionLower.includes('thunder')) {
    return {
      type: 'storm',
      color: 'text-accent-yellow',
      fill: 'fill-accent-yellow',
    };
  }

  if (conditionLower.includes('snow')) {
    return {
      type: 'snow',
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
 */
export function formatTime(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
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

