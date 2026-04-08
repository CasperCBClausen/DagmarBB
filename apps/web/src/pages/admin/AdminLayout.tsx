import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../hooks/useApi';

const LANGUAGES = [
  { code: 'da', label: 'DA', flag: '🇩🇰' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user, logout, refreshToken } = useAuthStore();
  const [langOpen, setLangOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { if (refreshToken) await apiClient.post('/auth/logout', { refreshToken }); } catch { /* ignore */ }
    logout();
    navigate('/');
  };

  const tabs = [
    ...(user?.role === 'ADMIN' ? [
      { path: '/admin/financials', label: t('admin.financials') },
      { path: '/admin/administration', label: t('admin.administration') },
      { path: '/admin/pricing', label: t('admin.pricing') },
    ] : []),
    { path: '/admin/cleaning', label: t('admin.cleaning') },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '1rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Link to="/" style={{ color: 'white', fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, textDecoration: 'none' }}>
              Dagmar B&B
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.6)', marginLeft: '0.75rem', fontSize: '0.875rem' }}>Admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>{user?.name}</span>
            {/* Language switcher */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setLangOpen(v => !v)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '0.375rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                {LANGUAGES.find(l => l.code === i18n.language)?.flag || '🌐'} {i18n.language.toUpperCase()}
              </button>
              {langOpen && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', backgroundColor: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', zIndex: 100, minWidth: '100px' }}>
                  {LANGUAGES.map(lang => (
                    <button key={lang.code}
                      onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.875rem', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer', color: '#333' }}
                    >
                      {lang.flag} {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '0.375rem 0.875rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}>
              {t('admin.logout')}
            </button>
          </div>
        </div>
      </header>

      <nav style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex' }}>
          {tabs.map(tab => (
            <Link key={tab.path} to={tab.path} style={{
              padding: '0.875rem 1.5rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: location.pathname === tab.path ? 'var(--color-primary)' : '#666',
              borderBottom: `2px solid ${location.pathname === tab.path ? 'var(--color-primary)' : 'transparent'}`,
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}>
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      <main style={{ flex: 1, backgroundColor: 'var(--color-bg)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
