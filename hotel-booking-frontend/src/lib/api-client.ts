import axios, { InternalAxiosRequestConfig } from "axios";

const getStoredSessionToken = () => localStorage.getItem("session_id");

// Define base URL based on environment
const getBaseURL = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Local fallback for development.
  if (window.location.hostname === "localhost") {
    return "http://localhost:5000";
  }

  // Safe production fallback. Set VITE_API_BASE_URL in production builds.
  return `${window.location.protocol}//${window.location.hostname}`;
};

export const getApiBaseUrl = getBaseURL;

// Extend axios config to include metadata
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: { retryCount: number };
}

const clearStoredProfile = () => {
  localStorage.removeItem("session_id");
  localStorage.removeItem("user_id");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_image");
  localStorage.removeItem("user_role");
};

// Create axios instance with consistent configuration
const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Ensure cookies are sent with requests
  timeout: 30000, // 30 second timeout
});

axiosInstance.interceptors.request.use((config: CustomAxiosRequestConfig) => {
  config.metadata = { retryCount: 0 };

  const token = getStoredSessionToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Response interceptor to handle common errors and retries
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;

    if (error.response?.status === 401) {
      clearStoredProfile();
    }

    // Handle rate limiting (429) with retry logic
    if (error.response?.status === 429 && config) {
      const customConfig = config as CustomAxiosRequestConfig;
      if (customConfig.metadata && customConfig.metadata.retryCount < 3) {
        const customConfig = config as CustomAxiosRequestConfig;
        if (customConfig.metadata) {
          customConfig.metadata.retryCount += 1;

          // Exponential backoff: wait 1s, 2s, 4s
          const delay =
            Math.pow(2, customConfig.metadata.retryCount - 1) * 1000;

          await new Promise((resolve) => setTimeout(resolve, delay));

          return axiosInstance(config);
        }
      }
    }

    // Handle network errors with retry
    if (!error.response && config) {
      const customConfig = config as CustomAxiosRequestConfig;
      if (customConfig.metadata && customConfig.metadata.retryCount < 2) {
        const customConfig = config as CustomAxiosRequestConfig;
        if (customConfig.metadata) {
          customConfig.metadata.retryCount += 1;

          // Wait 2 seconds before retry
          await new Promise((resolve) => setTimeout(resolve, 2000));

          return axiosInstance(config);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
