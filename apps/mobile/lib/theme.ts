import { themes, type ThemeName } from '@dagmar/shared';

export function getThemeColors(theme: ThemeName) {
  const t = themes[theme];
  return {
    bg: t['--color-bg'],
    surface: t['--color-surface'],
    primary: t['--color-primary'],
    accent: t['--color-accent'],
    text: t['--color-text'],
  };
}
