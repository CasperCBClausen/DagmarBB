import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';
import { apiClient } from '../../hooks/useApi';
import type { Room } from '@dagmar/shared';

export default function RoomsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [bookingMode, setBookingMode] = React.useState<'manual' | 'autonomous'>('manual');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      apiClient.get<Room[]>('/rooms'),
      apiClient.get<{ bookingMode: 'manual' | 'autonomous' }>('/settings'),
    ])
      .then(([roomsRes, settingsRes]) => {
        setRooms(roomsRes.data);
        setBookingMode(settingsRes.data.bookingMode);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.25rem', color: 'var(--color-primary)', marginBottom: '0.75rem' }}>
            {t('rooms.title')}
          </h1>
          <p style={{ color: '#666', fontSize: '1.0625rem' }}>{t('rooms.subtitle')}</p>
          <hr style={{ maxWidth: '200px', margin: '1.5rem auto' }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {rooms.map((room, index) => (
              <div key={room.id} className="card" style={{ display: 'grid', gridTemplateColumns: index % 2 === 0 ? '1fr 1.5fr' : '1.5fr 1fr', overflow: 'hidden' }}>
                <div style={{
                  order: index % 2 === 0 ? 0 : 1,
                  minHeight: '280px',
                  backgroundColor: 'var(--color-accent)',
                  opacity: 0.2,
                }} />
                <div style={{ padding: '2rem', order: index % 2 === 0 ? 1 : 0 }}>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.625rem', marginBottom: '0.75rem', color: 'var(--color-primary)' }}>
                    {room.name}
                  </h2>
                  <p style={{ color: '#555', lineHeight: 1.7, marginBottom: '1.5rem' }}>{room.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {room.amenities.slice(0, 5).map(a => (
                      <span key={a} style={{
                        fontSize: '0.8rem',
                        padding: '0.25rem 0.625rem',
                        backgroundColor: 'var(--color-bg)',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '3px',
                        color: '#666',
                      }}>{a}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: '0.25rem' }}>
                        {t('rooms.max_guests', { count: room.maxGuests })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <Link to={`/rooms/${room.slug}`} className="btn-secondary">{t('rooms.availability')}</Link>
                      {bookingMode === 'manual' ? (
                        <Link to="/about" className="btn-primary">{t('rooms.book_now')}</Link>
                      ) : (
                        <Link to={`/book/${room.slug}`} className="btn-primary">{t('rooms.book_now')}</Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
