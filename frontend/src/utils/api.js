import axios from "axios";

/*
  FIXED BASE URL LOGIC:
  - If VITE_API_BASE_URL exists → clean & use it
  - Otherwise fallback to localhost:3004 (map-service)
  - NEVER allow an empty string as baseURL
*/

let envBase = import.meta.env.VITE_API_BASE_URL;

// Ensure valid string
if (typeof envBase === "string") {
  envBase = envBase.trim();
}

// If empty or undefined → fallback
if (!envBase) {
  envBase = "http://localhost:3004";
}

// Remove trailing slash for consistency
const API_BASE = envBase.replace(/\/+$/, "");

console.log("[api] Using API base URL:", API_BASE);

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// --- Optional: attach auth token ---
// api.interceptors.request.use(cfg => {
//   const token = localStorage.getItem("token");
//   if (token) cfg.headers.Authorization = `Bearer ${token}`;
//   return cfg;
// });

// Request logger
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.info(
        "[api] Request:",
        config.method?.toUpperCase(),
        config.baseURL + config.url
      );
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Normalize errors to readable format
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const normalized = {
      message: err.message,
      status: err.response?.status ?? null,
      data: err.response?.data ?? null,
      isNetworkError: !!err.request && !err.response,
    };

    err.apiError = normalized;

    if (import.meta.env.DEV) {
      console.error("[api] Error:", normalized);
    }

    return Promise.reject(err);
  }
);

export default api;
