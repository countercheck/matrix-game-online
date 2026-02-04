import { describe, it, expect } from 'vitest';
import { api } from './api';

describe('API Client Configuration', () => {
  it('should use /api as baseURL in development (default)', () => {
    // In test/dev environment without VITE_API_URL, should use /api
    // The actual value depends on whether VITE_API_URL is set during build
    const baseURL = api.defaults.baseURL;
    expect(typeof baseURL).toBe('string');
    expect(baseURL).toMatch(/\/api$/);
  });

  it('should include required headers for CSRF protection', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json');
    expect(api.defaults.headers['X-Requested-With']).toBe('XMLHttpRequest');
  });

  it('should have response interceptor configured', () => {
    // Verify that response interceptors are set up
    expect(api.interceptors.response.handlers.length).toBeGreaterThan(0);
  });
});
