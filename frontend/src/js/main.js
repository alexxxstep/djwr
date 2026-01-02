/**
 * Main entry point for DjangoWeatherReminder frontend
 */

// Import main CSS file with Tailwind directives
import '../css/main.css';

// Import modules
import { initSearch } from './search.js';
import { initSidebar, initPeriodNavigation, initCityNavigation } from './ui.js';
import { loadSubscribedCitiesWithWeather, renderSubscribedCitiesList, selectCityFromList, addNewLocation } from './subscriptions.js';
import { fetchWeatherForecast, updateWeatherDisplay, updateHourlyForecast, updateAirConditions } from './weather.js';
import { updateSelectedCityDetail } from './ui.js';
import { isAuthenticated, login, register, logout, getCurrentUser } from './auth.js';

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
});

/**
 * Initialize authentication UI
 */
function initAuthUI() {
  // Check authentication status
  if (isAuthenticated()) {
    showAuthenticatedUI();
    loadUserInfo();
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
function showAuthenticatedUI() {
  // Hide auth form
  const authFormWrapper = document.getElementById('auth-form-wrapper');
  if (authFormWrapper) {
    authFormWrapper.classList.add('hidden');
  }

  // Show weather content
  const weatherContent = document.getElementById('weather-content');
  if (weatherContent) {
    weatherContent.classList.remove('hidden');
  }

  // Show cities panel
  const citiesPanel = document.getElementById('cities-panel-wrapper');
  if (citiesPanel) {
    citiesPanel.classList.remove('hidden');
  }

  // Show main navigation
  const mainNavigation = document.getElementById('main-navigation');
  if (mainNavigation) {
    mainNavigation.classList.remove('hidden');
  }

  // Show period navigation
  const periodNav = document.getElementById('period-navigation');
  if (periodNav) {
    periodNav.classList.remove('hidden');
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

  // Hide main navigation
  const mainNavigation = document.getElementById('main-navigation');
  if (mainNavigation) {
    mainNavigation.classList.add('hidden');
  }

  // Hide period navigation
  const periodNav = document.getElementById('period-navigation');
  if (periodNav) {
    periodNav.classList.add('hidden');
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
    [loginEmail, loginPassword].forEach(input => {
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
    [registerEmail, registerPassword].forEach(input => {
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
    showAuthenticatedUI();
    loadUserInfo();
    initializeWeatherApp();
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'Login failed. Please check your credentials.';
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
    showAuthenticatedUI();
    loadUserInfo();
    initializeWeatherApp();
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'Registration failed. Please try again.';
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
      listContainer.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">Please log in to see your subscribed cities</div>';
    }
    return;
  }

  try {
    // Load subscribed cities with weather
    const citiesData = await loadSubscribedCitiesWithWeather();

    if (citiesData && citiesData.length > 0) {
      // Render cities list
      renderSubscribedCitiesList(citiesData);

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
        listContainer.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">No subscribed cities. Use search to add cities.</div>';
      }
    }
  } catch (error) {
    console.error('Failed to initialize weather app:', error);
    // Show error message
    const listContainer = document.getElementById('subscribed-cities-list');
    if (listContainer) {
      listContainer.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">Failed to load cities. API endpoints may not be available yet.</div>';
    }
  }
}

/**
 * Load weather for a city
 */
async function loadWeatherForCity(cityId, period = 'current') {
  try {
    const weatherData = await fetchWeatherForecast(cityId, period);

    if (!weatherData) {
      throw new Error('No weather data received');
    }

    // Update main weather display
    updateWeatherDisplay(weatherData);

    // Update selected city detail
    updateSelectedCityDetail(cityId, weatherData);

    // Update air conditions
    updateAirConditions(weatherData);

    // Load hourly forecast if period is current or hourly
    if (period === 'current' || period === 'hourly') {
      try {
        const hourlyData = await fetchWeatherForecast(cityId, 'hourly');
        if (hourlyData && Array.isArray(hourlyData.list)) {
          updateHourlyForecast(hourlyData.list);
        } else {
          // Show empty state for hourly forecast
          const container = document.getElementById('hourly-forecast-container');
          if (container) {
            container.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">Hourly forecast not available</div>';
          }
        }
      } catch (error) {
        console.error('Failed to load hourly forecast:', error);
        const container = document.getElementById('hourly-forecast-container');
        if (container) {
          container.innerHTML = '<div class="text-center py-8 text-dark-text-secondary text-sm">Failed to load hourly forecast</div>';
        }
      }
    }
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
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // City selection event
  document.addEventListener('citySelected', async (e) => {
    if (!isAuthenticated()) return;

    const { cityId, city } = e.detail;

    if (cityId) {
      await loadWeatherForCity(cityId, 'current');
    } else if (city) {
      // New city selected from search
      // Could create subscription or just show weather
      console.log('City selected from search:', city);
    }
  });

  // Period selection event
  document.addEventListener('periodSelected', async (e) => {
    const { period } = e.detail;
    const selectedCityId = document.querySelector('.city-list-item.active')?.getAttribute('data-city-id');

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

// Export for potential module usage
export default {};
