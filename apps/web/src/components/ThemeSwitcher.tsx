import React from 'react';
import { useThemeStore } from '../store/themeStore';
import { themeNames, themeLabels, themes, type ThemeName } from '@dagmar/shared';

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = React.useState(false);

  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1000 }}>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '3rem',
          right: 0,
          backgroundColor: 'white',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '8px',
          padding: '0.75rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          minWidth: '180px',
        }}>
          <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem', fontWeight: 500 }}>THEME</p>
          {themeNames.map((name) => (
            <button
              key={name}
              onClick={() => { setTheme(name); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.375rem 0.5rem',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: theme === name ? 'rgba(0,0,0,0.06)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: (themes[name] as any)['--color-primary'],
                flexShrink: 0,
                border: theme === name ? '2px solid currentColor' : '2px solid transparent',
              }} />
              {themeLabels[name]}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        title="Switch theme"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.1rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🎨
      </button>
    </div>
  );
}
