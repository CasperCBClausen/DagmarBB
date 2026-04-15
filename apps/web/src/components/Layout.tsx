import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../hooks/useApi';

const LANGUAGES = [
  { code: 'da', label: 'DA', flag: '🇩🇰' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'nl', label: 'NL', flag: '🇳🇱' },
  { code: 'it', label: 'IT', flag: '🇮🇹' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [langOpen, setLangOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      if (refreshToken) await apiClient.post('/auth/logout', { refreshToken });
    } catch { /* ignore */ }
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <header style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex flex-col leading-none">
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              Dagmar B&B
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', letterSpacing: '0.1em' }}>
              RIBE · DENMARK
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="nav-link">{t('nav.home')}</Link>
            <Link to="/book" className="nav-link">{t('nav.book')}</Link>
            <Link to="/about" className="nav-link">{t('nav.about')}</Link>
            {user && ['ADMIN', 'CLEANER'].includes(user.role) && (
              <>
                {user.role === 'ADMIN' && (
                  <>
                    <Link to="/admin/financials" className="nav-link">{t('admin.financials')}</Link>
                    <Link to="/admin/administration" className="nav-link">{t('admin.administration')}</Link>
                  </>
                )}
                <Link to="/admin/cleaning" className="nav-link">{t('admin.cleaning')}</Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {/* My Booking link */}
            <Link to="/my-booking" className="nav-link hidden md:inline" style={{ fontSize: '0.875rem' }}>{t('nav.my_booking')}</Link>

            {/* Language switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="text-sm px-2 py-1 rounded border"
                style={{ borderColor: 'rgba(0,0,0,0.15)', color: 'var(--color-text)' }}
              >
                {LANGUAGES.find(l => l.code === i18n.language)?.flag || '🌐'} {i18n.language.toUpperCase()}
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded border z-50" style={{ minWidth: 100 }}>
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {lang.flag} {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <button onClick={handleLogout} className="btn-secondary text-sm px-3 py-1">{t('admin.logout')}</button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer style={{ backgroundColor: 'var(--color-surface)', borderTop: '1px solid rgba(0,0,0,0.08)', padding: '3rem 1rem' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary)', marginBottom: '0.75rem' }}>Dagmar B&B</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>Dagmarsgade 12<br />6760 Ribe, {t('footer.country')}</p>
          </div>
          <div>
            <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.75rem', fontSize: '1rem' }}>{t('footer.contact')}</h4>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              <a href="mailto:info@dagmarbb.dk" style={{ color: 'var(--color-primary)' }}>info@dagmarbb.dk</a><br />
              <a href="tel:+4512345678" style={{ color: 'var(--color-primary)' }}>+45 12 34 56 78</a>
            </p>
          </div>
          <div>
            <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.75rem', fontSize: '1rem' }}>Links</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem' }}>
              <Link to="/book" style={{ color: 'var(--color-primary)' }}>{t('nav.book')}</Link>
              <Link to="/about" style={{ color: 'var(--color-primary)' }}>{t('nav.about')}</Link>
              <Link to="/login" style={{ color: '#999', fontSize: '0.8rem' }}>{t('nav.login')}</Link>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem', color: '#999' }}>
          © {new Date().getFullYear()} Dagmar B&B · Ribe, {t('footer.country')}
        </div>
      </footer>

      <style>{`
        .nav-link {
          font-size: 0.9375rem;
          color: var(--color-text);
          text-decoration: none;
          transition: color 0.15s;
        }
        .nav-link:hover {
          color: var(--color-primary);
        }
      `}</style>
    </div>
  );
}
