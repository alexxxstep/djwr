/**
 * Authentication functionality
 * Refactored version - includes User Profile API
 */

import {
  apiRequest,
  apiGet,
  apiPost,
  apiPatch,
  setAuthToken,
  setRefreshToken,
  removeAuthToken,
  getAuthToken,
  handleApiError,
} from './api.js';
import { API_ENDPOINTS } from './config.js';
import cache from './cache.js';

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User data with tokens
 */
export async function login(email, password) {
  try {
    const data = await apiPost(API_ENDPOINTS.login, { email, password });

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
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} User data with tokens
 */
export async function register(userData) {
  try {
    const data = await apiPost(API_ENDPOINTS.register, userData);

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
 * Logout user
 */
export async function logout() {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await apiPost(API_ENDPOINTS.logout, { refresh: refreshToken });
    }
  } catch {
    // Ignore logout API errors
  } finally {
    removeAuthToken();
    cache.clear();
    window.location.reload();
  }
}

/**
 * Get current user info
 * @returns {Promise<Object|null>} User data or null
 */
export async function getCurrentUser() {
  try {
    return await apiGet(API_ENDPOINTS.me);
  } catch (error) {
    handleApiError(error);
    return null;
  }
}

/**
 * Get user profile (includes webhook_url)
 * @returns {Promise<Object|null>} User profile or null
 */
export async function getUserProfile() {
  try {
    return await apiGet(API_ENDPOINTS.userProfile);
  } catch (error) {
    handleApiError(error);
    return null;
  }
}

/**
 * Update user profile
 * @param {Object} data - Profile data to update
 * @returns {Promise<Object>} Updated profile
 */
export async function updateUserProfile(data) {
  try {
    return await apiPatch(API_ENDPOINTS.userProfile, data);
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
export function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * OAuth login redirect
 * @param {string} provider - OAuth provider name
 */
export function oauthLogin(provider) {
  window.location.href = `/oauth/login/${provider}/`;
}

/**
 * Handle OAuth callback
 */
export function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    setAuthToken(token);
    window.location.href = '/';
  }
}

/**
 * Show user profile modal
 */
export async function showUserProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) {
    console.error('Profile modal not found in DOM. Available modals:', {
      subscription: !!document.getElementById('subscription-modal'),
      profile: !!document.getElementById('profile-modal'),
    });
    alert('Profile modal not found. Please refresh the page.');
    return;
  }

  try {
    // Try to load user profile data
    let profile = await getUserProfile();

    // If getUserProfile fails, try getCurrentUser as fallback
    if (!profile) {
      const user = await getCurrentUser();
      if (user) {
        profile = {
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          webhook_url: null,
        };
      }
    }

    if (!profile) {
      console.error('Failed to load profile: both getUserProfile and getCurrentUser returned null');
      showProfileError('Failed to load profile data');
      // Still show modal with empty fields
      modal.classList.remove('hidden');
      setupProfileModalHandlers();
      return;
    }

    // Populate form fields
    setProfileFieldValue('profile-email', profile.email || '');
    setProfileFieldValue('profile-username', profile.username || '');
    setProfileFieldValue('profile-first-name', profile.first_name || '');
    setProfileFieldValue('profile-last-name', profile.last_name || '');
    setProfileFieldValue('profile-webhook-url', profile.webhook_url || '');

    // Clear messages
    hideProfileMessages();

    // Show modal
    modal.classList.remove('hidden');
    setupProfileModalHandlers();
  } catch (error) {
    console.error('Failed to load profile:', error);
    showProfileError('Failed to load profile data: ' + (error.message || 'Unknown error'));
    // Still show modal even if loading fails
    modal.classList.remove('hidden');
    setupProfileModalHandlers();
  }
}

/**
 * Hide user profile modal
 */
export function hideUserProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  hideProfileMessages();
}

/**
 * Setup profile modal event handlers
 */
function setupProfileModalHandlers() {
  const form = document.getElementById('profile-form');
  const closeBtn = document.getElementById('profile-modal-close-btn');
  const cancelBtn = document.getElementById('profile-cancel-btn');

  // Remove old handlers
  if (form) {
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
  }

  // Re-get elements
  const newForm = document.getElementById('profile-form');
  const newCloseBtn = document.getElementById('profile-modal-close-btn');
  const newCancelBtn = document.getElementById('profile-cancel-btn');

  if (newForm) {
    newForm.addEventListener('submit', handleProfileSubmit);
  }

  if (newCloseBtn) {
    newCloseBtn.onclick = hideUserProfileModal;
  }

  if (newCancelBtn) {
    newCancelBtn.onclick = hideUserProfileModal;
  }

  // Close on backdrop click
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        hideUserProfileModal();
      }
    };
  }
}

/**
 * Handle profile form submission
 */
async function handleProfileSubmit(e) {
  e.preventDefault();

  const saveBtn = document.getElementById('profile-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  hideProfileMessages();

  try {
    // Username is read-only, so don't include it in update
    const formData = {
      first_name: getProfileFieldValue('profile-first-name') || null,
      last_name: getProfileFieldValue('profile-last-name') || null,
      webhook_url: getProfileFieldValue('profile-webhook-url') || null,
    };

    // Remove null/empty values
    Object.keys(formData).forEach((key) => {
      if (formData[key] === null || formData[key] === '') {
        delete formData[key];
      }
    });

    await updateUserProfile(formData);

    showProfileSuccess('Profile updated successfully!');

    // Update user info in sidebar
    await updateUserInfoInSidebar();

    // Close modal after 1 second
    setTimeout(() => {
      hideUserProfileModal();
    }, 1000);
  } catch (error) {
    console.error('Failed to update profile:', error);
    const errorMessage = error?.response?.detail || error?.message || 'Failed to update profile';
    showProfileError(errorMessage);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  }
}

/**
 * Update user info in sidebar
 */
async function updateUserInfoInSidebar() {
  try {
    const user = await getCurrentUser();
    if (user) {
      const userNameEl = document.getElementById('user-name');
      if (userNameEl) {
        const displayName = user.username || user.first_name || user.email || 'User';
        userNameEl.textContent = displayName;
        userNameEl.setAttribute('title', user.email || '');
      }
    }
  } catch (error) {
    console.error('Failed to update user info:', error);
  }
}

/**
 * Helper functions
 */
function setProfileFieldValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function getProfileFieldValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function showProfileError(message) {
  const errorEl = document.getElementById('profile-error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

function showProfileSuccess(message) {
  const successEl = document.getElementById('profile-success-message');
  if (successEl) {
    successEl.textContent = message;
    successEl.classList.remove('hidden');
  }
}

function hideProfileMessages() {
  const errorEl = document.getElementById('profile-error-message');
  const successEl = document.getElementById('profile-success-message');
  if (errorEl) errorEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');
}

// Re-export for convenience
export { getAuthToken, removeAuthToken } from './api.js';
