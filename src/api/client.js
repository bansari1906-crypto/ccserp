import axios from 'axios';

export const LIVE_BACKEND_URL = 'https://docs-organizational-beverages-improve.trycloudflare.com';
export const LIVE_API_URL = `${LIVE_BACKEND_URL}/api`;
export const APK_DOWNLOAD_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APK_URL) || 
  `${LIVE_BACKEND_URL}/downloads/CCS-Connect.apk`;

const isNativeApp = typeof window !== 'undefined' && (
  window.location.protocol === 'capacitor:' || 
  Boolean(window.Capacitor?.isNativePlatform?.()) ||
  (window.location.hostname === 'localhost' && !import.meta.env.DEV)
);

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('api_server_url') || localStorage.getItem('ccs_api_url');
    if (custom) return custom.replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.VITE_APP_API_URL) return import.meta.env.VITE_APP_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:8000/api';
  return LIVE_API_URL;
};

const API_URL = getApiUrl();

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Interceptor to attach access token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle 401 and refresh token
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = localStorage.getItem('refresh_token');

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const payload = refreshToken ? { refresh: refreshToken } : {};
        const res = await axios.post(
          `${API_URL}/auth/token/refresh/`,
          payload,
          { withCredentials: true }
        );
        const { access } = res.data;
        if (access) {
          localStorage.setItem('access_token', access);
          client.defaults.headers.common['Authorization'] = `Bearer ${access}`;
          originalRequest.headers['Authorization'] = `Bearer ${access}`;
          return client(originalRequest);
        }
      } catch (err) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export { API_URL };
export default client;

