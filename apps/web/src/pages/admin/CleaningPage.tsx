import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from './AdminLayout';
import { apiClient } from '../../hooks/useApi';
import type { CleaningStatus } from '@dagmar/shared';

const STATE_CONFIG = {
  CLEAN: { label: 'Rent', color: '#10b981', bg: '#d1fae5', emoji: '✓' },
  NEEDS_CLEANING: { label: 'Skal rengøres', color: '#ef4444', bg: '#fee2e2', emoji: '!' },
  IN_PROGRESS: { label: 'I gang', color: '#f59e0b', bg: '#fef3c7', emoji: '↻' },
};

export default function CleaningPage() {
  const { t } = useTranslation();
  const [statuses, setStatuses] = React.useState<CleaningStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState<string | null>(null);

  const load = () => {
    apiClient.get<CleaningStatus[]>('/cleaning/status')
      .then(r => setStatuses(r.data))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const updateState = async (roomId: string, state: 'CLEAN' | 'NEEDS_CLEANING' | 'IN_PROGRESS') => {
    setUpdating(roomId);
    try {
      await apiClient.patch(`/cleaning/${roomId}`, { state });
      load();
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <AdminLayout><div style={{ padding: '4rem', textAlign: 'center' }}>{t('common.loading')}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem' }}>{t('admin.cleaning')}</h1>
        <button onClick={load} className="btn-secondary" style={{ fontSize: '0.875rem' }}>↻ Opdater</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {statuses.map(s => {
          const cfg = STATE_CONFIG[s.state];
          return (
            <div key={s.roomId} className="card" style={{ padding: '1.5rem', borderTop: `4px solid ${cfg.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem' }}>{s.room?.name}</h3>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '4px',
                  backgroundColor: cfg.bg,
                  color: cfg.color,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}>
                  {cfg.emoji} {cfg.label}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1.25rem' }}>
                Opdateret: {new Date(s.updatedAt).toLocaleString('da-DK')}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {s.state !== 'CLEAN' && (
                  <button
                    onClick={() => updateState(s.roomId, 'CLEAN')}
                    disabled={updating === s.roomId}
                    className="btn-primary"
                    style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                  >
                    {t('admin.mark_clean')}
                  </button>
                )}
                {s.state !== 'IN_PROGRESS' && (
                  <button
                    onClick={() => updateState(s.roomId, 'IN_PROGRESS')}
                    disabled={updating === s.roomId}
                    className="btn-secondary"
                    style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                  >
                    Start rengøring
                  </button>
                )}
                {s.state !== 'NEEDS_CLEANING' && (
                  <button
                    onClick={() => updateState(s.roomId, 'NEEDS_CLEANING')}
                    disabled={updating === s.roomId}
                    style={{ fontSize: '0.8125rem', padding: '0.3125rem 0.75rem', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {t('admin.mark_dirty')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {statuses.length === 0 && (
          <p style={{ color: '#888', padding: '2rem' }}>Ingen rengøringsstatusser tilgængelige.</p>
        )}
      </div>
    </AdminLayout>
  );
}
