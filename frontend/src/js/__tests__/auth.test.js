/**
 * Tests for Authentication module
 */

import {
  login,
  register,
  logout,
  getCurrentUser,
  getUserProfile,
  updateUserProfile,
  isAuthenticated,
  oauthLogin,
  handleOAuthCallback,
} from '../auth.js';
import * as api from '../api.js';
import cache from '../cache.js';

// Mock API module
jest.mock('../api.js', () => ({
  apiRequest: jest.fn(),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  removeAuthToken: jest.fn(),
  getAuthToken: jest.fn(),
  handleApiError: jest.fn(),
}));

// Mock cache
jest.mock('../cache.js', () => ({
  __esModule: true,
  default: {
    clear: jest.fn(),
  },
}));

// Mock config
jest.mock('../config.js', () => ({
  API_ENDPOINTS: {
    login: 'auth/login/',
    register: 'auth/register/',
    logout: 'auth/logout/',
    me: 'auth/me/',
    userProfile: 'users/me/',
  },
}));

describe('Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    test('successfully logs in and stores tokens', async () => {
      const mockResponse = {
        tokens: {
          access: 'access-token',
          refresh: 'refresh-token',
        },
        user: { email: 'test@example.com' },
      };

      api.apiPost.mockResolvedValueOnce(mockResponse);

      const result = await login('test@example.com', 'password123');

      expect(api.apiPost).toHaveBeenCalledWith('auth/login/', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(api.setAuthToken).toHaveBeenCalledWith('access-token');
      expect(api.setRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual(mockResponse);
    });

    test('handles response without tokens', async () => {
      const mockResponse = {
        user: { email: 'test@example.com' },
      };

      api.apiPost.mockResolvedValueOnce(mockResponse);

      const result = await login('test@example.com', 'password123');

      expect(api.setAuthToken).not.toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    test('handles login error', async () => {
      const error = new Error('Invalid credentials');
      api.apiPost.mockRejectedValueOnce(error);

      await expect(login('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('register', () => {
    test('successfully registers and stores tokens', async () => {
      const mockResponse = {
        tokens: {
          access: 'access-token',
          refresh: 'refresh-token',
        },
        user: { email: 'new@example.com' },
      };

      api.apiPost.mockResolvedValueOnce(mockResponse);

      const userData = {
        email: 'new@example.com',
        username: 'newuser',
        password: 'password123',
        password2: 'password123',
      };

      const result = await register(userData);

      expect(api.apiPost).toHaveBeenCalledWith('auth/register/', userData);
      expect(api.setAuthToken).toHaveBeenCalledWith('access-token');
      expect(api.setRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual(mockResponse);
    });

    test('handles registration error', async () => {
      const error = new Error('Email already exists');
      api.apiPost.mockRejectedValueOnce(error);

      await expect(
        register({
          email: 'existing@example.com',
          username: 'user',
          password: 'pass',
          password2: 'pass',
        })
      ).rejects.toThrow('Email already exists');
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      // Mock window.location.reload
      delete window.location;
      window.location = { reload: jest.fn() };
    });

    test('successfully logs out and clears tokens', async () => {
      localStorage.setItem('refresh_token', 'refresh-token');
      api.apiPost.mockResolvedValueOnce({});

      await logout();

      expect(api.apiPost).toHaveBeenCalledWith('auth/logout/', { refresh: 'refresh-token' });
      expect(api.removeAuthToken).toHaveBeenCalled();
      expect(cache.clear).toHaveBeenCalled();
      expect(window.location.reload).toHaveBeenCalled();
    });

    test('clears tokens even on logout API error', async () => {
      localStorage.setItem('refresh_token', 'refresh-token');
      api.apiPost.mockRejectedValueOnce(new Error('Network error'));

      await logout();

      expect(api.removeAuthToken).toHaveBeenCalled();
      expect(cache.clear).toHaveBeenCalled();
      expect(window.location.reload).toHaveBeenCalled();
    });

    test('handles missing refresh token', async () => {
      // No refresh token set

      await logout();

      expect(api.apiPost).not.toHaveBeenCalled();
      expect(api.removeAuthToken).toHaveBeenCalled();
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    test('successfully gets current user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
      };

      api.apiGet.mockResolvedValueOnce(mockUser);

      const result = await getCurrentUser();

      expect(api.apiGet).toHaveBeenCalledWith('auth/me/');
      expect(result).toEqual(mockUser);
    });

    test('returns null on error', async () => {
      const error = new Error('401 Unauthorized');
      api.apiGet.mockRejectedValueOnce(error);

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('getUserProfile', () => {
    test('successfully gets user profile', async () => {
      const mockProfile = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        webhook_url: 'https://example.com/webhook',
      };

      api.apiGet.mockResolvedValueOnce(mockProfile);

      const result = await getUserProfile();

      expect(api.apiGet).toHaveBeenCalledWith('users/me/');
      expect(result).toEqual(mockProfile);
    });

    test('returns null on error', async () => {
      api.apiGet.mockRejectedValueOnce(new Error('Not found'));

      const result = await getUserProfile();

      expect(result).toBeNull();
      expect(api.handleApiError).toHaveBeenCalled();
    });
  });

  describe('updateUserProfile', () => {
    test('successfully updates user profile', async () => {
      const mockUpdated = {
        id: 1,
        email: 'test@example.com',
        webhook_url: 'https://new-webhook.com',
      };

      api.apiPatch.mockResolvedValueOnce(mockUpdated);

      const result = await updateUserProfile({ webhook_url: 'https://new-webhook.com' });

      expect(api.apiPatch).toHaveBeenCalledWith('users/me/', {
        webhook_url: 'https://new-webhook.com',
      });
      expect(result).toEqual(mockUpdated);
    });

    test('throws error on update failure', async () => {
      const error = new Error('Invalid data');
      api.apiPatch.mockRejectedValueOnce(error);

      await expect(updateUserProfile({ invalid: 'data' })).rejects.toThrow('Invalid data');
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('isAuthenticated', () => {
    test('returns true when token exists', () => {
      api.getAuthToken.mockReturnValueOnce('token');

      expect(isAuthenticated()).toBe(true);
    });

    test('returns false when no token', () => {
      api.getAuthToken.mockReturnValueOnce(null);

      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('oauthLogin', () => {
    test('redirects to OAuth provider', () => {
      delete window.location;
      window.location = { href: '' };

      oauthLogin('google');

      expect(window.location.href).toBe('/oauth/login/google/');
    });

    test('supports multiple providers', () => {
      delete window.location;
      window.location = { href: '' };

      oauthLogin('github');
      expect(window.location.href).toBe('/oauth/login/github/');
    });
  });

  describe('handleOAuthCallback', () => {
    test('stores token from URL and redirects', () => {
      delete window.location;
      window.location = {
        href: '',
        search: '?token=oauth-token',
      };

      handleOAuthCallback();

      expect(api.setAuthToken).toHaveBeenCalledWith('oauth-token');
      expect(window.location.href).toBe('/');
    });

    test('does nothing if no token in URL', () => {
      delete window.location;
      window.location = {
        href: '/callback',
        search: '',
      };

      handleOAuthCallback();

      expect(api.setAuthToken).not.toHaveBeenCalled();
    });
  });
});
