/**
 * Tests for API client module
 */

import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getRefreshToken,
  setRefreshToken,
  isAuthenticated,
  apiRequest,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  handleApiError,
} from '../api.js';
import cache from '../cache.js';

// Mock fetch globally
global.fetch = jest.fn();

// Mock cache
jest.mock('../cache.js', () => ({
  __esModule: true,
  default: {
    clear: jest.fn(),
  },
}));

describe('API Client', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Clear mocks
    global.fetch.mockClear();
    cache.clear.mockClear();
  });

  describe('Token Management', () => {
    test('getAuthToken returns token from localStorage', () => {
      localStorage.setItem('access_token', 'test-token');
      expect(getAuthToken()).toBe('test-token');
    });

    test('getAuthToken returns null when no token', () => {
      expect(getAuthToken()).toBeNull();
    });

    test('setAuthToken saves token to localStorage', () => {
      setAuthToken('new-token');
      expect(localStorage.getItem('access_token')).toBe('new-token');
    });

    test('getRefreshToken returns refresh token from localStorage', () => {
      localStorage.setItem('refresh_token', 'refresh-token');
      expect(getRefreshToken()).toBe('refresh-token');
    });

    test('setRefreshToken saves refresh token to localStorage', () => {
      setRefreshToken('new-refresh-token');
      expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token');
    });

    test('removeAuthToken removes both tokens and clears cache', () => {
      localStorage.setItem('access_token', 'token');
      localStorage.setItem('refresh_token', 'refresh');

      removeAuthToken();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(cache.clear).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    test('returns true when token exists', () => {
      localStorage.setItem('access_token', 'token');
      expect(isAuthenticated()).toBe(true);
    });

    test('returns false when no token', () => {
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('apiRequest', () => {
    test('makes GET request with JWT token', async () => {
      localStorage.setItem('access_token', 'test-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: 'test' }),
      });

      const result = await apiRequest('test/');

      expect(global.fetch).toHaveBeenCalledWith('/api/test/', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
      expect(result).toEqual({ data: 'test' });
    });

    test('makes POST request with body', async () => {
      localStorage.setItem('access_token', 'test-token');
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ success: true }),
      });

      const result = await apiRequest('test/', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/test/', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
      expect(result).toEqual({ success: true });
    });

    test('makes request without token when not authenticated', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: 'public' }),
      });

      const result = await apiRequest('public/');

      expect(global.fetch).toHaveBeenCalledWith('/api/public/', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result).toEqual({ data: 'public' });
    });

    test('handles 401 error and attempts token refresh', async () => {
      localStorage.setItem('access_token', 'expired-token');
      localStorage.setItem('refresh_token', 'valid-refresh');

      // First request returns 401
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: { get: () => 'application/json' },
          json: async () => ({ detail: 'Token expired' }),
        })
        // Refresh token request succeeds
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ access: 'new-token' }),
        })
        // Retry original request succeeds
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: 'success' }),
        });

      const result = await apiRequest('protected/');

      expect(result).toEqual({ data: 'success' });
      expect(localStorage.getItem('access_token')).toBe('new-token');
    });

    test('throws error when refresh fails', async () => {
      localStorage.setItem('access_token', 'expired-token');
      localStorage.setItem('refresh_token', 'invalid-refresh');

      // First request returns 401
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: { get: () => 'application/json' },
          json: async () => ({ detail: 'Token expired' }),
        })
        // Refresh fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: { get: () => 'application/json' },
          json: async () => ({ detail: 'Invalid refresh token' }),
        });

      await expect(apiRequest('protected/')).rejects.toThrow('Authentication required');
    });

    test('handles error response with JSON', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ detail: 'Invalid data' }),
      });

      await expect(apiRequest('test/')).rejects.toThrow('Invalid data');
    });

    test('handles error response without JSON', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          get: () => 'text/html',
        },
      });

      await expect(apiRequest('test/')).rejects.toThrow('Internal Server Error');
    });

    test('handles network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiRequest('test/')).rejects.toThrow('Network error');
    });

    test('handles non-JSON response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'text/plain',
        },
      });

      const result = await apiRequest('test/');
      expect(result).toBeNull();
    });
  });

  describe('apiGet', () => {
    test('makes GET request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: 'get' }),
      });

      const result = await apiGet('resource/');

      expect(global.fetch).toHaveBeenCalledWith('/api/resource/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result).toEqual({ data: 'get' });
    });
  });

  describe('apiPost', () => {
    test('makes POST request with data', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ id: 1 }),
      });

      const result = await apiPost('resource/', { name: 'test' });

      expect(global.fetch).toHaveBeenCalledWith('/api/resource/', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('apiPatch', () => {
    test('makes PATCH request with data', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ updated: true }),
      });

      const result = await apiPatch('resource/1/', { name: 'updated' });

      expect(global.fetch).toHaveBeenCalledWith('/api/resource/1/', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'updated' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(result).toEqual({ updated: true });
    });
  });

  describe('apiDelete', () => {
    test('makes DELETE request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => null,
      });

      const result = await apiDelete('resource/1/');

      expect(global.fetch).toHaveBeenCalledWith('/api/resource/1/', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('handleApiError', () => {
    test('returns error info object', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('Test error');
      error.status = 400;
      error.response = { detail: 'Error detail' };

      const result = handleApiError(error);

      expect(result.message).toBe('Test error');
      expect(result.status).toBe(400);
      expect(result.response).toEqual({ detail: 'Error detail' });

      consoleSpy.mockRestore();
    });

    test('handles error without status', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('Network error');

      const result = handleApiError(error);

      expect(result.message).toBe('Network error');
      expect(result.status).toBeUndefined();

      consoleSpy.mockRestore();
    });

    test('provides default message for empty error', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = handleApiError({});

      expect(result.message).toBe('An error occurred');

      consoleSpy.mockRestore();
    });
  });
});
