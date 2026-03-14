import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, updateTokens, logout } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refreshToken });
          await updateTokens(res.data.accessToken, res.data.refreshToken);
          original.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return apiClient(original);
        } catch {
          await logout();
        }
      } else {
        await logout();
      }
    }
    return Promise.reject(error);
  }
);
