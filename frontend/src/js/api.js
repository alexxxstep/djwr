/**
 * Base API client with JWT authentication
 */

const API_BASE_URL = '/api/';

/**
 * Get JWT access token from localStorage
 */
export function getAuthToken() {
  return localStorage.getItem('access_token');
}

/**
 * Set JWT access token in localStorage
 */
export function setAuthToken(token) {
  localStorage.setItem('access_token', token);
}

/**
 * Remove JWT token from localStorage
 */
export function removeAuthToken() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

/**
 * Get refresh token from localStorage
 */
export function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

/**
 * Set refresh token in localStorage
 */
export function setRefreshToken(token) {
  localStorage.setItem('refresh_token', token);
}

/**
 * Make API request with JWT authentication
 */
export async function apiRequest(url, options = {}) {
  const token = getAuthToken();

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

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);

    // Handle token expiry
    if (response.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry request with new token
        const newToken = getAuthToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
          ...config,
          headers,
        });
        return handleResponse(retryResponse);
      } else {
        // Redirect to login
        window.location.href = '/api/auth/login/';
        throw new Error('Authentication required');
      }
    }

    const result = await handleResponse(response);
    return result;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Handle API response
 */
async function handleResponse(response) {
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    let error;
    try {
      error = contentType?.includes('application/json')
        ? await response.json()
        : { detail: response.statusText };
    } catch (e) {
      error = { detail: response.statusText || `HTTP ${response.status}` };
    }

    const errorMessage = error.detail || error.message || `HTTP ${response.status}`;
    const apiError = new Error(errorMessage);
    apiError.status = response.status;
    apiError.response = error;
    throw apiError;
  }

  if (contentType?.includes('application/json')) {
    try {
      const jsonData = await response.json();
      return jsonData;
    } catch (e) {
      return null;
    }
  }

  return await response.text();
}

/**
 * Refresh access token
 */
async function refreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}auth/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh }),
    });

    if (response.ok) {
      const data = await response.json();
      setAuthToken(data.access);
      if (data.refresh) {
        setRefreshToken(data.refresh);
      }
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }

  return false;
}

/**
 * Handle API errors
 */
export function handleApiError(error) {
  console.error('API Error:', error);

  // Don't redirect if API endpoints are not available yet (404, etc.)
  if (
    error.message.includes('401') ||
    error.message.includes('Authentication')
  ) {
    // Only redirect if user was trying to access authenticated endpoint
    const token = getAuthToken();
    if (token) {
      removeAuthToken();
      // Don't redirect immediately, let the app handle it gracefully
    }
  }

  return {
    message: error.message || 'An error occurred',
    error: error,
  };
}
