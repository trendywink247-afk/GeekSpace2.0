// ============================================================
// Shared Axios instance — imported by all domain service files
// ============================================================

import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh / logout on 401 (skip for auth endpoints — 401 there means wrong credentials)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      const isAuthEndpoint = ['/auth/login', '/auth/signup', '/auth/demo', '/auth/google', '/auth/github'].some(
        (p) => url.includes(p),
      );
      if (!isAuthEndpoint) {
        // Clear raw token and Zustand persisted auth state so UI resets cleanly
        localStorage.removeItem('gs_token');
        localStorage.removeItem('gs-auth');
        window.location.href = '/login';
      }
    }
    // Propagate requestId from response headers (33.5)
    if (err.response?.headers) {
      const reqId = err.response.headers['x-request-id'] ?? err.response.data?.requestId;
      if (reqId && err.response.data && typeof err.response.data === 'object') {
        err.response.data.requestId = reqId;
      }
    }
    return Promise.reject(err);
  },
);

export default api;
