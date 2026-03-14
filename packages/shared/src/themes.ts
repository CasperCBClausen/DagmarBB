export const themes = {
  'half-timbered': {
    '--color-bg': '#FAFAF8',
    '--color-surface': '#FFFFFF',
    '--color-primary': '#7A3B1E',
    '--color-accent': '#B8924A',
    '--color-text': '#1C1C1C',
    '--font-heading': "'Playfair Display', Georgia, serif",
    '--font-body': "'Inter', system-ui, sans-serif",
  },
  'cathedral': {
    '--color-bg': '#F9F9F9',
    '--color-surface': '#FFFFFF',
    '--color-primary': '#26375A',
    '--color-accent': '#A07E28',
    '--color-text': '#1A1A1A',
    '--font-heading': "'Cormorant Garamond', Georgia, serif",
    '--font-body': "'Source Sans 3', system-ui, sans-serif",
  },
  'nordic': {
    '--color-bg': '#F8F9F7',
    '--color-surface': '#FFFFFF',
    '--color-primary': '#3D5E38',
    '--color-accent': '#6A95A8',
    '--color-text': '#1A1A1A',
    '--font-heading': "'Lora', Georgia, serif",
    '--font-body': "'Nunito', system-ui, sans-serif",
  },
  'amber-evening': {
    '--color-bg': '#FAF8F5',
    '--color-surface': '#FFFFFF',
    '--color-primary': '#5C2230',
    '--color-accent': '#C07848',
    '--color-text': '#1A1A1A',
    '--font-heading': "'Cinzel', Georgia, serif",
    '--font-body': "'Raleway', system-ui, sans-serif",
  },
  'river-mist': {
    '--color-bg': '#F7F9F8',
    '--color-surface': '#FFFFFF',
    '--color-primary': '#2E4E45',
    '--color-accent': '#7AADA0',
    '--color-text': '#1A1A1A',
    '--font-heading': "'Spectral', Georgia, serif",
    '--font-body': "'DM Sans', system-ui, sans-serif",
  },
} as const;

export type ThemeName = keyof typeof themes;
export const themeNames = Object.keys(themes) as ThemeName[];

export const themeLabels: Record<ThemeName, string> = {
  'half-timbered': 'Half-Timbered Warmth',
  'cathedral': 'Cathedral Stone',
  'nordic': 'Nordic Farmhouse',
  'amber-evening': 'Amber Evening',
  'river-mist': 'River Mist',
};
