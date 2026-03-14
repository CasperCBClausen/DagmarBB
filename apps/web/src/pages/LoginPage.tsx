import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../components/Layout';
import { apiClient } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import type { LoginResponse } from '@dagmar/shared';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  if (user && ['ADMIN', 'CLEANER'].includes(user.role)) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/financials' : '/admin/cleaning'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post<LoginResponse>('/auth/login', { email, password });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      navigate(res.data.user.role === 'ADMIN' ? '/admin/financials' : '/admin/cleaning');
    } catch {
      setError('Forkert e-mail eller adgangskode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>
            Dagmar B&B
          </h1>
          <p style={{ textAlign: 'center', color: '#888', marginBottom: '2rem', fontSize: '0.875rem' }}>
            {t('nav.login')}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>E-mail</label>
              <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>Adgangskode</label>
              <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && (
              <p style={{ color: '#c0392b', fontSize: '0.875rem', padding: '0.625rem', backgroundColor: '#fdf0ef', borderRadius: '4px' }}>
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.75rem', marginTop: '0.5rem' }}>
              {loading ? t('common.loading') : 'Log ind'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
