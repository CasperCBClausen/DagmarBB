import { create } from 'zustand';
import type { ThemeName } from '@dagmar/shared';

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('dagmar-theme') as ThemeName) || 'half-timbered',
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dagmar-theme', theme);
    set({ theme });
  },
}));
