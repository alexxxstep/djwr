/**
 * Base API client with JWT authentication
 * Refactored version - clean, simple, no legacy code
 */

import cache from './cache.js';

const API_BASE_URL = '/api/';

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Get JWT access token from localStorage
 * @returns {string|null} Access token
 */
export function getAuthToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Set JWT access token in localStorage
 * @param {string} token - Access token
 */
export function setAuthToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/**
 * Get refresh token from localStorage
 * @returns {string|null} Refresh token
 */
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Set refresh token in localStorage
 * @param {string} token - Refresh token
 */
export function setRefreshToken(token) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Remove all auth tokens and clear cache
 */
export function removeAuthToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  cache.clear();
}

/**
 * Check if user is authenticated (has token)
 * @returns {boolean} True if authenticated
 */
export function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Refresh access token using refresh token
 * @returns {Promise<boolean>} True if refresh successful
 */
async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.access) {
        setAuthToken(data.access);
        if (data.refresh) {
          setRefreshToken(data.refresh);
        }
        return true;
      }
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }

  return false;
}

/**
 * Create API error from response
 * @param {Response} response - Fetch response
 * @param {Object} errorData - Parsed error data
 * @returns {Error} API error
 */
function createApiError(response, errorData) {
  const message = errorData.detail
    || errorData.message
    || errorData.error
    || `HTTP ${response.status}`;

  const error = new Error(message);
  error.status = response.status;
  error.response = errorData;
  return error;
}

/**
 * Make API request with JWT authentication
 * @param {string} url - API endpoint (relative to base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<*>} Response data
 */
export async function apiRequest(url, options = {}) {
  const token = getAuthToken();
  const isAuthEndpoint = url.includes('auth/login') || url.includes('auth/register');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const fullUrl = `${API_BASE_URL}${url}`;

  try {
    let response = await fetch(fullUrl, config);

    // Handle 401 - try to refresh token (not for auth endpoints)
    if (response.status === 401 && !isAuthEndpoint) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // Retry with new token
        headers['Authorization'] = `Bearer ${getAuthToken()}`;
        response = await fetch(fullUrl, { ...config, headers });
      } else {
        // Refresh failed - clear tokens
        removeAuthToken();
        throw createApiError(response, { detail: 'Authentication required' });
      }
    }

    // Parse response
    const contentType = response.headers.get('content-type');
    let data = null;

    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }

    // Handle errors
    if (!response.ok) {
      throw createApiError(response, data || { detail: response.statusText });
    }

    return data;
  } catch (error) {
    // Re-throw API errors
    if (error.status) {
      throw error;
    }

    // Wrap network errors
    console.error('API request failed:', error);
    const apiError = new Error(error.message || 'Network error');
    apiError.status = 0;
    apiError.response = { detail: error.message };
    throw apiError;
  }
}

/**
 * Make GET request
 * @param {string} url - API endpoint
 * @returns {Promise<*>} Response data
 */
export function apiGet(url) {
  return apiRequest(url, { method: 'GET' });
}

/**
 * Make POST request
 * @param {string} url - API endpoint
 * @param {Object} data - Request body
 * @returns {Promise<*>} Response data
 */
export function apiPost(url, data) {
  return apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Make PATCH request
 * @param {string} url - API endpoint
 * @param {Object} data - Request body
 * @returns {Promise<*>} Response data
 */
export function apiPatch(url, data) {
  return apiRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Make DELETE request
 * @param {string} url - API endpoint
 * @returns {Promise<*>} Response data
 */
export function apiDelete(url) {
  return apiRequest(url, { method: 'DELETE' });
}

/**
 * Handle API error (logging utility)
 * @param {Error} error - API error
 * @returns {Object} Error info object
 */
export function handleApiError(error) {
  console.error('API Error:', error.message, error.response);

  return {
    message: error.message || 'An error occurred',
    status: error.status,
    response: error.response,
  };
}
