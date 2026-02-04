import axios from 'axios';

// Use environment variable for API URL in production, fall back to /api for development
const apiRoot = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  : '';

const baseURL = apiRoot ? `${apiRoot}/api` : '/api';
export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF protection
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
