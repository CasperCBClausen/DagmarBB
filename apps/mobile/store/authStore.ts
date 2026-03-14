import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@dagmar/shared';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoaded: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  updateTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoaded: false,

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('dagmar-auth');
      if (stored) {
        const { user, accessToken, refreshToken } = JSON.parse(stored);
        set({ user, accessToken, refreshToken });
      }
    } catch { /* ignore */ }
    finally { set({ isLoaded: true }); }
  },

  setAuth: async (user, accessToken, refreshToken) => {
    await AsyncStorage.setItem('dagmar-auth', JSON.stringify({ user, accessToken, refreshToken }));
    set({ user, accessToken, refreshToken });
  },

  updateTokens: async (accessToken, refreshToken) => {
    const stored = await AsyncStorage.getItem('dagmar-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      await AsyncStorage.setItem('dagmar-auth', JSON.stringify({ ...parsed, accessToken, refreshToken }));
    }
    set({ accessToken, refreshToken });
  },

  logout: async () => {
    await AsyncStorage.removeItem('dagmar-auth');
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
