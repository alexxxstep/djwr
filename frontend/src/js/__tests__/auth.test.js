/**
 * Tests for Authentication module
 */

import { login, register, logout, refreshToken, getCurrentUser, isAuthenticated } from '../auth.js';
import * as api from '../api.js';

// Mock API module
jest.mock('../api.js', () => ({
  apiRequest: jest.fn(),
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  removeAuthToken: jest.fn(),
  getAuthToken: jest.fn(),
  handleApiError: jest.fn(),
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

      api.apiRequest.mockResolvedValueOnce(mockResponse);

      const result = await login('test@example.com', 'password123');

      expect(api.apiRequest).toHaveBeenCalledWith('auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      });
      expect(api.setAuthToken).toHaveBeenCalledWith('access-token');
      expect(api.setRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual(mockResponse);
    });

    test('handles login error', async () => {
      const error = new Error('Invalid credentials');
      api.apiRequest.mockRejectedValueOnce(error);

      await expect(login('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
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

      api.apiRequest.mockResolvedValueOnce(mockResponse);

      const userData = {
        email: 'new@example.com',
        username: 'newuser',
        password: 'password123',
        password2: 'password123',
      };

      const result = await register(userData);

      expect(api.apiRequest).toHaveBeenCalledWith('auth/register/', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      expect(api.setAuthToken).toHaveBeenCalledWith('access-token');
      expect(api.setRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual(mockResponse);
    });

    test('handles registration error', async () => {
      const error = new Error('Email already exists');
      api.apiRequest.mockRejectedValueOnce(error);

      await expect(
        register({
          email: 'existing@example.com',
          username: 'user',
          password: 'pass',
          password2: 'pass',
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('logout', () => {
    test('successfully logs out and removes tokens', async () => {
      localStorage.setItem('access_token', 'token');
      localStorage.setItem('refresh_token', 'refresh-token');
      api.apiRequest.mockResolvedValueOnce({});

      // Mock reload function using Object.defineProperty
      const reloadSpy = jest.fn();
      Object.defineProperty(global.window.location, 'reload', {
        writable: true,
        configurable: true,
        value: reloadSpy,
      });

      await logout();

      expect(api.apiRequest).toHaveBeenCalledWith('auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh: 'refresh-token' }),
      });
      expect(api.removeAuthToken).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });

    test('handles logout error gracefully', async () => {
      localStorage.setItem('refresh_token', 'refresh-token');
      const error = new Error('Network error');
      api.apiRequest.mockRejectedValueOnce(error);

      // Mock reload function using Object.defineProperty
      const reloadSpy = jest.fn();
      Object.defineProperty(global.window.location, 'reload', {
        writable: true,
        configurable: true,
        value: reloadSpy,
      });

      // Logout should still remove tokens even on error
      await logout();

      expect(api.removeAuthToken).toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    test('successfully refreshes token', async () => {
      localStorage.setItem('refresh_token', 'refresh-token');
      const mockResponse = {
        access: 'new-access-token',
        refresh: 'new-refresh-token',
      };

      api.apiRequest.mockResolvedValueOnce(mockResponse);

      const result = await refreshToken();

      expect(api.apiRequest).toHaveBeenCalledWith('auth/refresh/', {
        method: 'POST',
        body: JSON.stringify({ refresh: 'refresh-token' }),
      });
      expect(api.setAuthToken).toHaveBeenCalledWith('new-access-token');
      expect(api.setRefreshToken).toHaveBeenCalledWith('new-refresh-token');
      expect(result).toBe(true);
    });

    test('returns false when no refresh token', async () => {
      const result = await refreshToken();
      expect(result).toBe(false);
    });

    test('returns false on refresh error', async () => {
      localStorage.setItem('refresh_token', 'invalid-token');
      api.apiRequest.mockRejectedValueOnce(new Error('Invalid token'));

      const result = await refreshToken();
      expect(result).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    test('successfully gets current user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
      };

      api.apiRequest.mockResolvedValueOnce(mockUser);

      const result = await getCurrentUser();

      expect(api.apiRequest).toHaveBeenCalledWith('auth/me/');
      expect(result).toEqual(mockUser);
    });

    test('handles error when not authenticated', async () => {
      const error = new Error('401 Unauthorized');
      error.status = 401;
      api.apiRequest.mockRejectedValueOnce(error);
      api.handleApiError.mockImplementation(() => {});

      const result = await getCurrentUser();

      // getCurrentUser returns null on error, doesn't throw
      expect(result).toBeNull();
      expect(api.handleApiError).toHaveBeenCalledWith(error);
    });
  });

  describe('isAuthenticated', () => {
    test('returns true when token exists', () => {
      localStorage.setItem('access_token', 'token');
      api.getAuthToken.mockReturnValueOnce('token');

      expect(isAuthenticated()).toBe(true);
    });

    test('returns false when no token', () => {
      api.getAuthToken.mockReturnValueOnce(null);

      expect(isAuthenticated()).toBe(false);
    });
  });
});

