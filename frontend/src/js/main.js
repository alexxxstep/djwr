/**
 * Main entry point for DjangoWeatherReminder frontend
 * Refactored version - centralized state management
 */

import '../css/main.css';

import { DEFAULT_PERIOD, isValidPeriod } from './config.js';
import { initSearch } from './search.js';
import { initSidebar, initPeriodNavigation, initCityNavigation, initDragToScroll, initCitiesListDragScroll } from './ui.js';
import {
  loadSubscribedCitiesWithWeather,
  renderSubscribedCitiesList,
  selectCityFromList,
  addNewLocation,
  initTimeUpdates,
  stopTimeUpdates,
} from './subscriptions.js';
import {
  fetchWeatherForecast,
  updateWeatherDisplay,
  updateHourlyForecast,
  getWeatherDataArray,
} from './weather.js';
import {
  isAuthenticated,
  login,
  register,
  logout,
  getCurrentUser,
  showUserProfileModal,
} from './auth.js';

// Application state
const state = {
  selectedCityId: null,
  selectedPeriod: 'today',
  isLoading: false,
};

// Debounce helper
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Initialize application
 */
document.addEventListener('DOMContentLoaded', () => {

  // Initialize UI components
  initSidebar();
  initPeriodNavigation();
  initCityNavigation();

  // Initialize drag-to-scroll for forecast container
  setTimeout(() => {
    initDragToScroll();
    initCitiesListDragScroll();
  }, 100);

  // Initialize authentication
  initAuthUI();

  // Initialize weather app only for authenticated users
  if (isAuthenticated()) {
    initSearch();
    initializeWeatherApp();
    initTimeUpdates();
  } else {
    // Ensure all weather components are hidden for unauthenticated users
    hideAllWeatherComponents();
  }

  // Setup event listeners
  setupEventListeners();

  // Initialize mobile panel
  initMobileCitiesPanel();
});

/**
 * Initialize authentication UI
 */
function initAuthUI() {
  if (isAuthenticated()) {
    showAuthenticatedUI();
    loadUserInfo();
  } else {
    showUnauthenticatedUI();
  }

  setupAuthFormHandlers();

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopTimeUpdates();
      await logout();
    });
  }

  // Login/Register buttons in sidebar
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      scrollToAuthForm('login');
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      scrollToAuthForm('register');
    });
  }
}

/**
 * Scroll to auth form
 */
function scrollToAuthForm(type) {
  const authForm = document.getElementById('auth-form-container');
  if (!authForm) return;

  authForm.scrollIntoView({ behavior: 'smooth' });

  if (type === 'register') {
    const switchBtn = document.getElementById('switch-to-register');
    if (switchBtn) {
      setTimeout(() => switchBtn.click(), 300);
    }
  } else {
    const loginEmail = document.getElementById('login-email');
    if (loginEmail) {
      setTimeout(() => loginEmail.focus(), 300);
    }
  }
}

/**
 * Show authenticated UI
 */
async function showAuthenticatedUI() {
  // Hide auth form
  toggleElement('auth-form-wrapper', false);

  // Show weather content
  const weatherContent = document.getElementById('weather-content');
  if (weatherContent) {
    weatherContent.classList.remove('hidden');
    weatherContent.style.display = '';
    setTimeout(() => initSearch(), 100);
  }

  // Show search
  const citySearch = document.getElementById('city-search');
  if (citySearch) {
    citySearch.closest('.mb-6')?.classList.remove('hidden');
  }

  // Show forecast period buttons
  const periodButtons = document.querySelectorAll('.period-btn');
  periodButtons.forEach((btn) => {
    btn.classList.remove('hidden');
  });

  // Show weather components
  toggleElement('current-weather-content', true);
  toggleElement('hourly-forecast-container', true);
  toggleElement('air-conditions-grid', true);

  // Show cities panel
  toggleElement('cities-panel-wrapper', true);

  // Toggle auth buttons
  toggleElement('auth-buttons', false);
  toggleElement('logout-section', true);

  // Load subscriptions
  try {
    const citiesData = await loadSubscribedCitiesWithWeather();
    if (!citiesData || citiesData.length === 0) {
      showEmptyState();
    }
  } catch (error) {
    console.error('Failed to load subscriptions:', error);
  }
}

/**
 * Show unauthenticated UI
 */
function showUnauthenticatedUI() {
  toggleElement('auth-form-wrapper', true);

  // Hide all weather components
  hideAllWeatherComponents();

  toggleElement('cities-panel-wrapper', false);
  toggleElement('cities-panel-container', false);
  toggleElement('auth-buttons', true);
  toggleElement('logout-section', false);
}

/**
 * Hide all weather-related components
 */
function hideAllWeatherComponents() {
  const weatherContent = document.getElementById('weather-content');
  if (weatherContent) {
    weatherContent.classList.add('hidden');
    weatherContent.style.display = 'none';
  }

  // Hide search bar
  const citySearch = document.getElementById('city-search');
  if (citySearch) {
    const searchWrapper = citySearch.closest('.mb-6');
    if (searchWrapper) {
      searchWrapper.classList.add('hidden');
    }
  }

  // Hide current weather
  toggleElement('current-weather-content', false);

  // Hide hourly forecast
  toggleElement('hourly-forecast-container', false);

  // Hide air conditions
  toggleElement('air-conditions-grid', false);

  // Hide forecast period buttons
  const periodButtons = document.querySelectorAll('.period-btn');
  periodButtons.forEach((btn) => {
    btn.classList.add('hidden');
  });
}

/**
 * Show empty state for weather sections
 */
function showEmptyState() {
  const currentWeather = document.getElementById('current-weather-content');
  if (currentWeather) {
    currentWeather.innerHTML =
      '<div class="text-center py-8 text-dark-text-secondary">No subscribed cities. Use search to add cities.</div>';
  }

  const hourlyForecast = document.getElementById('hourly-forecast-container');
  if (hourlyForecast) {
    hourlyForecast.innerHTML = '';
  }

  const airConditions = document.getElementById('air-conditions-grid');
  if (airConditions) {
    airConditions.innerHTML = '';
  }
}

/**
 * Toggle element visibility
 */
function toggleElement(id, show) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.toggle('hidden', !show);
  }
}

/**
 * Load user info
 */
async function loadUserInfo() {
  try {
    const user = await getCurrentUser();
    if (user) {
      const userInfoBtn = document.getElementById('user-info');
      const userNameEl = document.getElementById('user-name');

      if (userInfoBtn && userNameEl) {
        // Set display name (username, first_name, or email)
        const displayName = user.username || user.first_name || user.email || 'User';
        userNameEl.textContent = displayName;
        userInfoBtn.setAttribute('title', user.email || '');

        // Remove existing event listeners by cloning (deep clone to preserve children)
        const newBtn = userInfoBtn.cloneNode(true);
        userInfoBtn.parentNode.replaceChild(newBtn, userInfoBtn);

        // Re-get elements after replacement
        const newUserInfoBtn = document.getElementById('user-info');
        const newUserNameEl = document.getElementById('user-name');

        if (newUserInfoBtn) {
          // Restore user name if it was lost during clone
          if (newUserNameEl && !newUserNameEl.textContent) {
            newUserNameEl.textContent = displayName;
          }

          // Add click handler to open profile modal
          newUserInfoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Check if modal exists
            const modal = document.getElementById('profile-modal');
            if (!modal) {
              console.error('Profile modal not found in DOM');
              return;
            }

            try {
              await showUserProfileModal();
            } catch (error) {
              console.error('Error opening profile modal:', error);
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('Failed to load user info:', error);
  }
}

/**
 * Setup auth form handlers
 */
function setupAuthFormHandlers() {
  // Switch forms
  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (switchToRegister && switchToLogin && loginForm && registerForm) {
    switchToRegister.addEventListener('click', () => {
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
    });

    switchToLogin.addEventListener('click', () => {
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    });
  }

  // Submit handlers
  document
    .getElementById('login-submit-btn')
    ?.addEventListener('click', handleLogin);
  document
    .getElementById('register-submit-btn')
    ?.addEventListener('click', handleRegister);

  // Enter key support
  ['login-email', 'login-password'].forEach((id) => {
    document.getElementById(id)?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  });

  ['register-email', 'register-password', 'register-password2'].forEach(
    (id) => {
      document.getElementById(id)?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
      });
    }
  );
}

/**
 * Handle login
 */
async function handleLogin() {
  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');

  if (!email || !password) {
    showError(errorEl, 'Please fill in all fields');
    return;
  }

  try {
    setButtonLoading(submitBtn, true, 'Logging in...');
    await login(email, password);

    showAuthenticatedUI();
    loadUserInfo();
    initializeWeatherApp();
    initTimeUpdates();
  } catch (error) {
    showError(errorEl, error.message || 'Login failed');
  } finally {
    setButtonLoading(submitBtn, false, 'Login');
  }
}

/**
 * Handle register
 */
async function handleRegister() {
  const email = document.getElementById('register-email')?.value;
  const username = document.getElementById('register-username')?.value;
  const password = document.getElementById('register-password')?.value;
  const password2 = document.getElementById('register-password2')?.value;
  const errorEl = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit-btn');

  if (!email || !username || !password || !password2) {
    showError(errorEl, 'Please fill in all fields');
    return;
  }

  if (password !== password2) {
    showError(errorEl, 'Passwords do not match');
    return;
  }

  try {
    setButtonLoading(submitBtn, true, 'Registering...');
    await register({ email, username, password, password2 });

    showAuthenticatedUI();
    loadUserInfo();
    initializeWeatherApp();
    initTimeUpdates();
  } catch (error) {
    showError(errorEl, error.message || 'Registration failed');
  } finally {
    setButtonLoading(submitBtn, false, 'Register');
  }
}

/**
 * Show error message
 */
function showError(el, message) {
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
}

/**
 * Set button loading state
 */
function setButtonLoading(btn, loading, text) {
  if (btn) {
    btn.disabled = loading;
    btn.textContent = text;
  }
}

/**
 * Initialize weather application
 */
async function initializeWeatherApp() {
  if (!isAuthenticated()) {
    const listContainer = document.getElementById('subscribed-cities-list');
    if (listContainer) {
      listContainer.innerHTML =
        '<div class="text-center py-8 text-dark-text-secondary text-sm">Please log in to see your subscribed cities</div>';
    }
    return;
  }

  try {
    const citiesData = await loadSubscribedCitiesWithWeather();

    if (citiesData && citiesData.length > 0) {
      renderSubscribedCitiesList(citiesData);
      initTimeUpdates();

      // Select first city
      const firstCity = citiesData[0];
      if (firstCity?.city) {
        selectCityFromList(firstCity.city.id);
        await loadWeatherForCity(firstCity.city.id);
      }
    } else {
      const listContainer = document.getElementById('subscribed-cities-list');
      if (listContainer) {
        listContainer.innerHTML =
          '<div class="text-center py-8 text-dark-text-secondary text-sm">No subscribed cities. Use search to add cities.</div>';
      }
    }
  } catch (error) {
    console.error('Failed to initialize weather app:', error);
    const listContainer = document.getElementById('subscribed-cities-list');
    if (listContainer) {
      listContainer.innerHTML =
        '<div class="text-center py-8 text-dark-text-secondary text-sm">Failed to load cities</div>';
    }
  }
}

/**
 * Load weather for a city
 */
async function loadWeatherForCity(cityId) {
  if (state.isLoading && state.selectedCityId === cityId) {
    return;
  }

  state.isLoading = true;
  state.selectedCityId = cityId;

  try {
    // Load current weather
    const weatherResponse = await fetchWeatherForecast(cityId, 'current');
    if (weatherResponse) {
      updateWeatherDisplay(weatherResponse);
    }

    // Load forecast
    await loadForecastForPeriod(cityId, state.selectedPeriod);
  } catch (error) {
    console.error('Failed to load weather:', error);
    showWeatherError();
  } finally {
    state.isLoading = false;
  }
}

/**
 * Load forecast for period
 */
async function loadForecastForPeriod(cityId, period) {
  if (!isValidPeriod(period)) {
    period = DEFAULT_PERIOD;
  }

  try {
    const forecastResponse = await fetchWeatherForecast(cityId, period);

    if (forecastResponse) {
      // Pass the full response object to preserve timezone_offset
      updateHourlyForecast(forecastResponse, period);
    } else {
      showForecastEmpty();
    }
  } catch (error) {
    console.error('Failed to load forecast:', error);
    showForecastEmpty();
  }
}

/**
 * Show weather error
 */
function showWeatherError() {
  const container = document.getElementById('current-weather-content');
  if (container) {
    container.innerHTML = `
      <div class="text-center py-12">
        <p class="text-dark-text-secondary mb-2">Failed to load weather data</p>
      </div>
    `;
  }
}

/**
 * Show forecast empty state
 */
function showForecastEmpty() {
  const container = document.getElementById('hourly-forecast-container');
  if (container) {
    container.innerHTML =
      '<div class="text-center py-8 text-dark-text-secondary text-sm">Forecast not available</div>';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Period selector
  setupPeriodSelector();

  // City selection (debounced)
  const handleCitySelected = debounce(async (e) => {
    if (!isAuthenticated()) return;

    const { cityId } = e.detail;
    if (cityId) {
      closeMobileCitiesPanel();
      await loadWeatherForCity(cityId);
    }
  }, 200);

  document.addEventListener('citySelected', handleCitySelected);

  // Period selection
  document.addEventListener('periodSelected', async (e) => {
    const { period } = e.detail;
    if (state.selectedCityId) {
      state.selectedPeriod = period;
      await loadForecastForPeriod(state.selectedCityId, period);
    }
  });

  // Add location button
  document
    .getElementById('add-location-btn')
    ?.addEventListener('click', addNewLocation);
}

/**
 * Setup period selector
 */
function setupPeriodSelector() {
  const periodButtons = document.querySelectorAll('.period-btn');

  // Set initial period from active button
  const activeBtn = Array.from(periodButtons).find((btn) =>
    btn.classList.contains('active')
  );
  if (activeBtn) {
    state.selectedPeriod = activeBtn.getAttribute('data-period') || 'today';
  }

  periodButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const period = btn.getAttribute('data-period');
      if (!period) return;

      // Update active state
      periodButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      state.selectedPeriod = period;

      if (state.selectedCityId) {
        await loadForecastForPeriod(state.selectedCityId, period);
      }
    });
  });
}

/**
 * Initialize mobile cities panel
 */
function initMobileCitiesPanel() {
  const toggleBtn = document.getElementById('mobile-cities-toggle');
  const closeBtn = document.getElementById('mobile-cities-close');
  const panelContainer = document.getElementById('cities-panel-container');
  const overlay = document.getElementById('cities-panel-overlay');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (panelContainer) {
        panelContainer.classList.remove('hidden');
        panelContainer.classList.add('slide-in-right');
      }
      if (overlay) {
        overlay.classList.remove('hidden');
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeMobileCitiesPanel);
  }

  if (overlay) {
    overlay.addEventListener('click', closeMobileCitiesPanel);
  }
}

/**
 * Close mobile cities panel
 */
function closeMobileCitiesPanel() {
  const panelContainer = document.getElementById('cities-panel-container');
  const overlay = document.getElementById('cities-panel-overlay');

  if (panelContainer) {
    panelContainer.classList.add('hidden');
    panelContainer.classList.remove('slide-in-right');
  }
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

export default {};
