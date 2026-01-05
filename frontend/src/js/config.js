/**
 * Frontend configuration constants
 * Aligned with REFACTORING_PLAN.md
 */

// Valid forecast periods (One Call API 3.0 limitation: max 7 days)
export const VALID_PERIODS = [
  'current',
  'hourly',
  'today',
  'tomorrow',
  '3days',
  'week',
];

// Default period for weather display
export const DEFAULT_PERIOD = 'current';

// Cache TTL in seconds (aligned with backend)
export const CACHE_TTL = {
  current: 600,    // 10 minutes
  hourly: 900,     // 15 minutes
  today: 1800,     // 30 minutes
  tomorrow: 1800,  // 30 minutes
  '3days': 3600,   // 60 minutes
  week: 3600,      // 60 minutes
};

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  login: 'auth/login/',
  register: 'auth/register/',
  logout: 'auth/logout/',
  refresh: 'auth/refresh/',
  me: 'auth/me/',

  // Cities
  cities: 'cities/',
  citySearch: 'cities/search/',
  cityDetail: (id) => `cities/${id}/`,

  // Weather
  weather: (cityId, period = 'current') => `weather/${cityId}/?period=${period}`,
  weatherHistory: (cityId) => `weather/${cityId}/history/`,

  // Subscriptions
  subscriptions: 'subscriptions/',
  subscriptionDetail: (id) => `subscriptions/${id}/`,

  // User profile
  userProfile: 'auth/me/',
};

// Period labels for UI
export const PERIOD_LABELS = {
  current: 'Now',
  hourly: 'Hourly',
  today: 'Today',
  tomorrow: 'Tomorrow',
  '3days': '3 Days',
  week: 'Week',
};

// Notification period options (in hours)
export const NOTIFICATION_PERIODS = [
  { value: 1, label: '1 hour' },
  { value: 3, label: '3 hours' },
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
];

// Notification types
export const NOTIFICATION_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'both', label: 'Both' },
];

/**
 * Validate if period is valid
 * @param {string} period - Period to validate
 * @returns {boolean} True if valid
 */
export function isValidPeriod(period) {
  return VALID_PERIODS.includes(period);
}

/**
 * Get cache TTL for period
 * @param {string} period - Forecast period
 * @returns {number} TTL in seconds
 */
export function getCacheTTL(period) {
  return CACHE_TTL[period] || CACHE_TTL.current;
}

