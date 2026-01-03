/**
 * Main entry point for DjangoWeatherReminder frontend
 */

// Import main CSS file with Tailwind directives
import '../css/main.css';

// Import modules
import { initSearch } from './search.js';
import { initSidebar, initPeriodNavigation, initCityNavigation } from './ui.js';
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
} from './weather.js';
import {
  isAuthenticated,
  login,
  register,
  logout,
  getCurrentUser,
} from './auth.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DjangoWeatherReminder frontend loaded');

  // Initialize UI components
  initSidebar();
  initPeriodNavigation();
  initCityNavigation();
  initSearch();

  // Initialize authentication UI
  initAuthUI();

  // Initialize subscriptions and weather
  initializeWeatherApp();

  // Setup event listeners
  setupEventListeners();

  // Initialize mobile cities panel
  initMobileCitiesPanel();

  // Initialize time updates for cities
  if (isAuthenticated()) {
    initTimeUpdates();
  }
});

/**
 * Initialize authentication UI
 */
function initAuthUI() {
  // Check authentication status
  if (isAuthenticated()) {
    showAuthenticatedUI().then(() => {
      loadUserInfo();
    });
  } else {
    showUnauthenticatedUI();
  }

  // Setup auth form handlers
  setupAuthFormHandlers();

  // Setup logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout?')) {
        stopTimeUpdates();
        await logout();
      }
    });
  }

  // Setup login/register buttons in sidebar
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      // Scroll to auth form and focus on login
      const authForm = document.getElementById('auth-form-container');
      if (authForm) {
        authForm.scrollIntoView({ behavior: 'smooth' });
        const loginEmail = document.getElementById('login-email');
        if (loginEmail) {
          setTimeout(() => loginEmail.focus(), 300);
        }
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      // Scroll to auth form and switch to register
      const authForm = document.getElementById('auth-form-container');
      const switchToRegister = document.getElementById('switch-to-register');
      if (authForm) {
        authForm.scrollIntoView({ behavior: 'smooth' });
        if (switchToRegister) {
          setTimeout(() => switchToRegister.click(), 300);
        }
      }
    });
  }
}

/**
 * Show authenticated UI
 */
async function showAuthenticatedUI() {
  // Hide auth form
  const authFormWrapper = document.getElementById('auth-form-wrapper');
  if (authFormWrapper) {
    authFormWrapper.classList.add('hidden');
  }

  // Always show weather content (including search) for authenticated users
  // Weather data will be shown only if user has subscriptions
  const weatherContent = document.getElementById('weather-content');
  if (weatherContent) {
    weatherContent.classList.remove('hidden');
    // Re-initialize search after showing weather content
    setTimeout(() => {
      initSearch();
    }, 100);
  }

  // Check if user has subscriptions to show weather data
  try {
    const citiesData = await loadSubscribedCitiesWithWeather();
    if (!citiesData || citiesData.length === 0) {
      // Hide weather data sections if no subscriptions, but keep search visible
      const currentWeatherCard = document.querySelector(
        '#current-weather-content'
      );
      const hourlyForecast = document.getElementById(
        'hourly-forecast-container'
      );

      if (currentWeatherCard) {
        currentWeatherCard.innerHTML =
          '<div class="text-center py-8 text-dark-text-secondary">No subscribed cities. Use search to add cities.</div>';
      }
      if (hourlyForecast) {
        hourlyForecast.innerHTML = '';
      }
      if (airConditions) {
        airConditions.innerHTML = '';
      }
    }
  } catch (error) {
    console.error('Failed to check subscriptions:', error);
  }

  // Show cities panel
  const citiesPanel = document.getElementById('cities-panel-wrapper');
  if (citiesPanel) {
    citiesPanel.classList.remove('hidden');
  }

  // Hide auth buttons, show logout
  const authButtons = document.getElementById('auth-buttons');
  const logoutSection = document.getElementById('logout-section');
  if (authButtons) {
    authButtons.classList.add('hidden');
  }
  if (logoutSection) {
    logoutSection.classList.remove('hidden');
  }
}

/**
 * Show unauthenticated UI
 */
function showUnauthenticatedUI() {
  // Show auth form
  const authFormWrapper = document.getElementById('auth-form-wrapper');
  if (authFormWrapper) {
    authFormWrapper.classList.remove('hidden');
  }

  // Hide weather content
  const weatherContent = document.getElementById('weather-content');
  if (weatherContent) {
    weatherContent.classList.add('hidden');
  }

  // Hide cities panel
  const citiesPanel = document.getElementById('cities-panel-wrapper');
  if (citiesPanel) {
    citiesPanel.classList.add('hidden');
  }

  // Show auth buttons, hide logout
  const authButtons = document.getElementById('auth-buttons');
  const logoutSection = document.getElementById('logout-section');
  if (authButtons) {
    authButtons.classList.remove('hidden');
  }
  if (logoutSection) {
    logoutSection.classList.add('hidden');
  }
}

/**
 * Load user info
 */
async function loadUserInfo() {
  try {
    const user = await getCurrentUser();
    if (user && user.email) {
      const userInfoEl = document.getElementById('user-info');
      if (userInfoEl) {
        userInfoEl.textContent = user.email;
        userInfoEl.setAttribute('title', user.email);
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
  // Switch between login and register forms
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

  // Login form submit
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  if (loginSubmitBtn) {
    loginSubmitBtn.addEventListener('click', handleLogin);
  }

  // Register form submit
  const registerSubmitBtn = document.getElementById('register-submit-btn');
  if (registerSubmitBtn) {
    registerSubmitBtn.addEventListener('click', handleRegister);
  }

  // Enter key support
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  if (loginEmail && loginPassword) {
    [loginEmail, loginPassword].forEach((input) => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleLogin();
        }
      });
    });
  }

  const registerEmail = document.getElementById('register-email');
  const registerPassword = document.getElementById('register-password');
  if (registerEmail && registerPassword) {
    [registerEmail, registerPassword].forEach((input) => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleRegister();
        }
      });
    });
  }
}

/**
 * Handle login
 */
async function handleLogin() {
  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  const errorEl = document.getElementById('login-error');

  if (!email || !password) {
    if (errorEl) {
      errorEl.textContent = 'Please fill in all fields';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  try {
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.textContent = 'Logging in...';
    }

    await login(email, password);

    // Success - reload UI
    showAuthenticatedUI().then(() => {
      loadUserInfo();
      initializeWeatherApp();
      initTimeUpdates();
    });
  } catch (error) {
    if (errorEl) {
      errorEl.textContent =
        error.message || 'Login failed. Please check your credentials.';
      errorEl.classList.remove('hidden');
    }
  } finally {
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Login';
    }
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

  if (!email || !username || !password || !password2) {
    if (errorEl) {
      errorEl.textContent = 'Please fill in all fields';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (password !== password2) {
    if (errorEl) {
      errorEl.textContent = 'Passwords do not match';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  try {
    const registerSubmitBtn = document.getElementById('register-submit-btn');
    if (registerSubmitBtn) {
      registerSubmitBtn.disabled = true;
      registerSubmitBtn.textContent = 'Registering...';
    }

    await register({
      email,
      username,
      password,
      password2,
    });

    // Success - reload UI
    showAuthenticatedUI().then(() => {
      loadUserInfo();
      initializeWeatherApp();
      initTimeUpdates();
    });
  } catch (error) {
    if (errorEl) {
      errorEl.textContent =
        error.message || 'Registration failed. Please try again.';
      errorEl.classList.remove('hidden');
    }
  } finally {
    const registerSubmitBtn = document.getElementById('register-submit-btn');
    if (registerSubmitBtn) {
      registerSubmitBtn.disabled = false;
      registerSubmitBtn.textContent = 'Register';
    }
  }
}

/**
 * Initialize weather application
 */
async function initializeWeatherApp() {
  if (!isAuthenticated()) {
    // Show empty state for non-authenticated users
    const listContainer = document.getElementById('subscribed-cities-list');
    if (listContainer) {
      listContainer.innerHTML =
        '<div class="text-center py-8 text-dark-text-secondary text-sm">Please log in to see your subscribed cities</div>';
    }
    return;
  }

  try {
    // Load subscribed cities with weather
    const citiesData = await loadSubscribedCitiesWithWeather();

    if (citiesData && citiesData.length > 0) {
      // Render cities list
      renderSubscribedCitiesList(citiesData);

      // Initialize time updates after rendering cities
      initTimeUpdates();

      // Select first city by default
      const firstCity = citiesData[0];
      if (firstCity && firstCity.city) {
        selectCityFromList(firstCity.city.id);
        await loadWeatherForCity(firstCity.city.id, 'current');
      }
    } else {
      // No subscriptions
      const listContainer = document.getElementById('subscribed-cities-list');
      if (listContainer) {
        listContainer.innerHTML =
          '<div class="text-center py-8 text-dark-text-secondary text-sm">No subscribed cities. Use search to add cities.</div>';
      }
    }
  } catch (error) {
    console.error('Failed to initialize weather app:', error);
    // Show error message
    const listContainer = document.getElementById('subscribed-cities-list');
    if (listContainer) {
      listContainer.innerHTML =
        '<div class="text-center py-8 text-dark-text-secondary text-sm">Failed to load cities. API endpoints may not be available yet.</div>';
    }
  }
}

// Track loading state to prevent multiple simultaneous calls
let isLoadingWeather = false;
let lastLoadedCityId = null;
let lastLoadedPeriod = null;
let selectedForecastPeriod = 'today'; // Default period for forecast display

/**
 * Load weather for a city
 */
async function loadWeatherForCity(cityId, period = 'current') {
  // Prevent multiple simultaneous calls for the same city and period
  if (
    isLoadingWeather &&
    lastLoadedCityId === cityId &&
    lastLoadedPeriod === period
  ) {
    return;
  }

  isLoadingWeather = true;
  lastLoadedCityId = cityId;
  lastLoadedPeriod = period;

  try {
    // Always load current weather first (for main card), regardless of period parameter
    const weatherData = await fetchWeatherForecast(cityId, 'current');

    if (!weatherData) {
      throw new Error('No weather data received');
    }

    // Update main weather display (includes air conditions)
    updateWeatherDisplay(weatherData);

    // Load forecast data based on selected period (separate from current weather)
    await loadForecastForPeriod(cityId, selectedForecastPeriod);
  } catch (error) {
    console.error('Failed to load weather:', error);
    // Show error in UI
    const container = document.getElementById('current-weather-content');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-12">
          <p class="text-dark-text-secondary mb-2">Failed to load weather data</p>
          <p class="text-sm text-dark-text-secondary">API endpoints may not be available yet (Phase 5 required)</p>
        </div>
      `;
    }
  } finally {
    isLoadingWeather = false;
  }
}

/**
 * Load forecast data for a specific period
 */
async function loadForecastForPeriod(cityId, period) {
  try {
    // Map frontend periods to backend API periods
    const apiPeriodMap = {
      today: 'hourly',
      tomorrow: 'hourly',
      '3days': '3days',
      week: 'week',
    };

    const apiPeriod = apiPeriodMap[period] || 'hourly';

    const forecastData = await fetchWeatherForecast(cityId, apiPeriod);

    if (!forecastData) {
      throw new Error('No forecast data received from API');
    }

    // Convert to array format if needed
    // API returns list of objects with city, period, and weather data
    let forecastArray = null;
    if (forecastData && Array.isArray(forecastData)) {
      // If it's already an array, use it directly
      forecastArray = forecastData;
    } else if (forecastData && Array.isArray(forecastData.list)) {
      // Legacy format with .list property
      forecastArray = forecastData.list;
    } else if (forecastData && typeof forecastData === 'object') {
      // Try to extract array from object keys
      const keys = Object.keys(forecastData)
        .filter((k) => !isNaN(parseInt(k)))
        .sort((a, b) => parseInt(a) - parseInt(b));
      if (keys.length > 0) {
        forecastArray = keys.map((k) => forecastData[k]);
      } else {
        // Single object - wrap in array
        forecastArray = [forecastData];
      }
    }

    if (forecastArray && forecastArray.length > 0) {
      updateHourlyForecast(forecastArray, period);
    } else {
      console.warn('Forecast array is empty or invalid:', {
        forecastData,
        forecastArray,
        period,
        apiPeriod,
      });
      const container = document.getElementById('hourly-forecast-container');
      if (container) {
        container.innerHTML =
          '<div class="text-center py-8 text-dark-text-secondary text-sm">Forecast not available</div>';
      }
    }
  } catch (error) {
    console.error('Failed to load forecast:', error, { cityId, period });
    const container = document.getElementById('hourly-forecast-container');
    if (container) {
      container.innerHTML =
        '<div class="text-center py-8 text-dark-text-secondary text-sm">Failed to load forecast</div>';
    }
  }
}

/**
 * Setup event listeners
 */
// Debouncing state for city selection
let citySelectedTimeout = null;
let lastCitySelectedId = null;
let lastCitySelectedTime = 0;
const CITY_SELECT_DEBOUNCE_MS = 500; // 500ms debounce

/**
 * Setup period selector buttons
 */
function setupPeriodSelector() {
  const periodButtons = document.querySelectorAll('.period-btn');
  periodButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const period = btn.getAttribute('data-period');
      if (!period) return;

      // Update active state
      periodButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Update selected period
      selectedForecastPeriod = period;

      // Reload forecast if city is selected (but keep current weather)
      if (lastLoadedCityId) {
        // Only reload forecast, don't reload current weather
        await loadForecastForPeriod(lastLoadedCityId, period);
      }
    });
  });
}

function setupEventListeners() {
  // Setup period selector
  setupPeriodSelector();

  // City selection event with debouncing
  document.addEventListener('citySelected', async (e) => {
    if (!isAuthenticated()) return;

    const { cityId, city } = e.detail;
    const now = Date.now();

    // Debounce: ignore if same city selected within debounce period
    if (
      cityId &&
      cityId === lastCitySelectedId &&
      now - lastCitySelectedTime < CITY_SELECT_DEBOUNCE_MS
    ) {
      return;
    }

    // Update immediately to prevent duplicate processing
    lastCitySelectedId = cityId;
    lastCitySelectedTime = now;

    // Clear previous timeout
    if (citySelectedTimeout) {
      clearTimeout(citySelectedTimeout);
    }

    // Set new timeout for debouncing
    citySelectedTimeout = setTimeout(async () => {
      // Close mobile cities panel if open
      closeMobileCitiesPanel();

      if (cityId) {
        await loadWeatherForCity(cityId, 'current');
      } else if (city) {
        // New city selected from search
        // Could create subscription or just show weather
        console.log('City selected from search:', city);
      }
    }, 100); // 100ms delay to batch rapid events
  });

  // Period selection event
  document.addEventListener('periodSelected', async (e) => {
    const { period } = e.detail;
    const selectedCityId = document
      .querySelector('.city-list-item.active')
      ?.getAttribute('data-city-id');

    if (selectedCityId) {
      await loadWeatherForCity(parseInt(selectedCityId), period);
    }
  });

  // Add location button
  const addLocationBtn = document.getElementById('add-location-btn');
  if (addLocationBtn) {
    addLocationBtn.addEventListener('click', () => {
      addNewLocation();
    });
  }
}

/**
 * Initialize mobile cities panel
 */
function initMobileCitiesPanel() {
  const toggleBtn = document.getElementById('mobile-cities-toggle');
  const closeBtn = document.getElementById('mobile-cities-close');
  const panelContainer = document.getElementById('cities-panel-container');
  const overlay = document.getElementById('cities-panel-overlay');

  // Toggle panel on button click
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

  // Close panel on close button click
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeMobileCitiesPanel();
    });
  }

  // Close panel on overlay click
  if (overlay) {
    overlay.addEventListener('click', () => {
      closeMobileCitiesPanel();
    });
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

// Export for potential module usage
export default {};
