// utils/api.js
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || 'http://localhost:3004';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  // do NOT set default 'Content-Type' here (especially not multipart/form-data)
});

// Optional: attach auth header if you use tokens (uncomment & adapt)
// api.interceptors.request.use(cfg => {
//   const token = localStorage.getItem('token');
//   if (token) cfg.headers.Authorization = `Bearer ${token}`;
//   return cfg;
// });

// Request logger (dev-friendly)
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.info('[api] Request:', config.method?.toUpperCase(), config.baseURL + config.url);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: return full response or normalized error
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Normalize axios error so callers can inspect err.apiError safely
    const normalized = {
      message: err.message,
      status: err.response?.status ?? null,
      data: err.response?.data ?? null,
      isNetworkError: !!err.request && !err.response,
    };
    // attach normalized info for easier debug in catch blocks
    err.apiError = normalized;
    if (import.meta.env.DEV) {
      console.error('[api] Error:', normalized);
    }
    return Promise.reject(err);
  }
);

export default api;
