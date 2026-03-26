import axios from "axios";

// Dev: call Flask on :5000. Production (e.g. Docker + nginx): same-origin /api — use empty baseURL.
const baseURL =
  import.meta.env.VITE_API_BASE_URL != null && String(import.meta.env.VITE_API_BASE_URL).trim() !== ""
    ? import.meta.env.VITE_API_BASE_URL
    : import.meta.env.PROD
      ? ""
      : "http://127.0.0.1:5000";

export const http = axios.create({
  baseURL,
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return config;
});
