import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeName } from '@dagmar/shared';

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'half-timbered',

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem('dagmar-theme') as ThemeName | null;
      if (stored) set({ theme: stored });
    } catch { /* ignore */ }
  },

  setTheme: async (theme) => {
    await AsyncStorage.setItem('dagmar-theme', theme);
    set({ theme });
  },
}));
