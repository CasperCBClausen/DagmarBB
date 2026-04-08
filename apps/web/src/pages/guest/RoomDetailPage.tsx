import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';
import { apiClient } from '../../hooks/useApi';
import type { Room } from '@dagmar/shared';

export default function RoomDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [room, setRoom] = React.useState<Room | null>(null);
  const [bookingMode, setBookingMode] = React.useState<'manual' | 'autonomous'>('manual');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!slug) return;
    Promise.all([
      apiClient.get<Room>(`/rooms/${slug}`),
      apiClient.get<{ bookingMode: 'manual' | 'autonomous' }>('/settings'),
    ])
      .then(([roomRes, settingsRes]) => {
        setRoom(roomRes.data);
        setBookingMode(settingsRes.data.bookingMode);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Layout><div style={{ padding: '8rem', textAlign: 'center' }}>{t('common.loading')}</div></Layout>;
  if (error || !room) return <Layout><div style={{ padding: '8rem', textAlign: 'center' }}>{t('common.error')}</div></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 1rem' }}>
        <Link to="/rooms" style={{ color: 'var(--color-accent)', fontSize: '0.875rem', marginBottom: '1.5rem', display: 'inline-block' }}>
          ← {t('rooms.title')}
        </Link>

        <div className="card" style={{ overflow: 'hidden', marginTop: '1rem' }}>
          <div style={{ height: '360px', backgroundColor: 'var(--color-accent)', opacity: 0.2 }} />

          <div style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                  {room.name}
                </h1>
                <p style={{ color: '#888', fontSize: '0.875rem' }}>{t('rooms.max_guests', { count: room.maxGuests })}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
              </div>
            </div>

            <hr />

            <p style={{ lineHeight: 1.8, marginBottom: '2rem', fontSize: '1.0625rem' }}>{room.description}</p>

            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1rem' }}>
              {t('rooms.amenities')}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2.5rem' }}>
              {room.amenities.map(a => (
                <span key={a} style={{
                  padding: '0.375rem 0.875rem',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}>✓ {a}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {bookingMode === 'manual' ? (
                <Link to="/about" className="btn-primary" style={{ fontSize: '1.0625rem', padding: '0.875rem 2rem' }}>
                  {t('rooms.book_now')}
                </Link>
              ) : (
                <Link to={`/book/${room.slug}`} className="btn-primary" style={{ fontSize: '1.0625rem', padding: '0.875rem 2rem' }}>
                  {t('rooms.book_now')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
