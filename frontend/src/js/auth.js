/**
 * Authentication functionality
 */

import {
  apiRequest,
  setAuthToken,
  setRefreshToken,
  removeAuthToken,
  handleApiError,
} from './api.js';

/**
 * Login with email and password
 */
export async function login(email, password) {
  try {
    const data = await apiRequest('auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.tokens) {
      setAuthToken(data.tokens.access);
      setRefreshToken(data.tokens.refresh);
    }

    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Register new user
 */
export async function register(userData) {
  try {
    const data = await apiRequest('auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (data.tokens) {
      setAuthToken(data.tokens.access);
      setRefreshToken(data.tokens.refresh);
    }

    return data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Logout
 */
export async function logout() {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await apiRequest('auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh: refreshToken }),
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with logout even if API call fails
  } finally {
    removeAuthToken();
    // Reload page to reset UI state
    window.location.reload();
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const data = await apiRequest('auth/me/');
    return data;
  } catch (error) {
    handleApiError(error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!localStorage.getItem('access_token');
}

/**
 * OAuth login redirect
 */
export function oauthLogin(provider) {
  window.location.href = `/oauth/login/${provider}/`;
}

/**
 * Handle OAuth callback (called after OAuth redirect)
 */
export async function handleOAuthCallback() {
  // This will be handled by the backend OAuth callback endpoint
  // which should redirect with tokens in URL or set them via cookies
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    setAuthToken(token);
    window.location.href = '/';
  }
}
