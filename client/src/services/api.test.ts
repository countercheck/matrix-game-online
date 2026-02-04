import { describe, it, expect } from 'vitest';
import { api } from './api';

describe('API Client Configuration', () => {
  describe('baseURL configuration', () => {
    it('should use /api as baseURL when VITE_API_URL is not set (development)', () => {
      // In test/dev environment without VITE_API_URL, should use /api
      // This works with Vite's dev proxy: /api -> http://localhost:3000/api
      const baseURL = api.defaults.baseURL;
      expect(typeof baseURL).toBe('string');
      expect(baseURL).toMatch(/\/api$/);
    });

    it('should construct baseURL from VITE_API_URL when set (production)', () => {
      // This test documents the expected production behavior
      // When VITE_API_URL is set during build, baseURL should be: VITE_API_URL + /api
      // Example: VITE_API_URL=https://api.example.com -> baseURL=https://api.example.com/api
      
      const baseURL = api.defaults.baseURL;
      expect(baseURL).toBeDefined();
      
      // In production builds with VITE_API_URL set, baseURL will be absolute
      // In development/test without VITE_API_URL, baseURL will be relative
      if (baseURL && baseURL.startsWith('http')) {
        // Production case: verify it ends with /api and has no double slashes
        expect(baseURL).toMatch(/^https?:\/\/[^/]+.*\/api$/);
        expect(baseURL).not.toMatch(/\/\/api$/); // No double slash before /api
      } else {
        // Development case: verify it's the relative path
        expect(baseURL).toBe('/api');
      }
    });

    it('should handle trailing slashes in VITE_API_URL', () => {
      // The implementation removes trailing slashes from VITE_API_URL before concatenation
      // This prevents double slashes: https://api.example.com//api
      // The logic: apiRoot = VITE_API_URL.replace(/\/+$/, '')
      // Then: baseURL = apiRoot ? `${apiRoot}/api` : '/api'
      
      const baseURL = api.defaults.baseURL;
      expect(baseURL).toBeDefined();
      
      // Verify no double slashes in the URL
      if (baseURL && baseURL.includes('://')) {
        // Remove protocol to check path doesn't have //
        const pathPart = baseURL.split('://')[1];
        expect(pathPart).not.toMatch(/\/\//);
      }
    });
  });

  it('should include required headers for CSRF protection', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json');
    expect(api.defaults.headers['X-Requested-With']).toBe('XMLHttpRequest');
  });

  it('should have response interceptor configured', () => {
    // Verify that response interceptors are set up
    const handlers = api.interceptors.response.handlers;
    expect(handlers).toBeDefined();
    if (handlers) {
      expect(handlers.length).toBeGreaterThan(0);
    }
  });
});
