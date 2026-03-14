import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';
import { apiClient } from '../../hooks/useApi';
import type { Room } from '@dagmar/shared';

export default function HomePage() {
  const { t } = useTranslation();
  const [rooms, setRooms] = React.useState<Room[]>([]);

  React.useEffect(() => {
    apiClient.get<Room[]>('/rooms').then(r => setRooms(r.data)).catch(() => {});
  }, []);

  return (
    <Layout>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(to bottom, var(--color-primary) 0%, rgba(0,0,0,0.7) 100%)',
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'white',
        padding: '4rem 1rem',
        position: 'relative',
      }}>
        <div style={{ maxWidth: '700px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, marginBottom: '1.25rem', color: 'white' }}>
            {t('home.hero_title')}
          </h1>
          <p style={{ fontSize: '1.125rem', marginBottom: '2.5rem', opacity: 0.9, lineHeight: 1.7 }}>
            {t('home.hero_subtitle')}
          </p>
          <Link to="/rooms" className="btn-primary" style={{ fontSize: '1.0625rem', padding: '0.875rem 2.5rem', backgroundColor: 'white', color: 'var(--color-primary)' }}>
            {t('home.hero_cta')}
          </Link>
        </div>
      </section>

      {/* About section */}
      <section style={{ padding: '5rem 1rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.25rem', color: 'var(--color-primary)' }}>
          {t('home.about_title')}
        </h2>
        <hr />
        <p style={{ fontSize: '1.0625rem', lineHeight: 1.8, color: 'var(--color-text)' }}>
          {t('home.about_text')}
        </p>
      </section>

      {/* Rooms preview */}
      {rooms.length > 0 && (
        <section style={{ padding: '3rem 1rem 5rem', maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.875rem', textAlign: 'center', marginBottom: '2.5rem', color: 'var(--color-primary)' }}>
            {t('home.rooms_title')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {rooms.slice(0, 3).map((room) => (
              <div key={room.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ height: '200px', backgroundColor: 'var(--color-accent)', opacity: 0.15 }} />
                <div style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>{room.name}</h3>
                  <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem', lineHeight: 1.6 }}>
                    {room.description.slice(0, 120)}...
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '1.0625rem' }}>
                      {room.pricePerNight.toLocaleString('da-DK')} DKK
                      <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: '#888' }}> / nat</span>
                    </span>
                    <Link to={`/rooms/${room.slug}`} className="btn-primary" style={{ fontSize: '0.875rem', padding: '0.4375rem 1rem' }}>
                      Se mere
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <Link to="/rooms" className="btn-secondary">{t('rooms.title')} →</Link>
          </div>
        </section>
      )}

      {/* Ribe section */}
      <section style={{ backgroundColor: 'var(--color-surface)', padding: '5rem 1rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.25rem', color: 'var(--color-primary)' }}>
            {t('home.ribe_title')}
          </h2>
          <hr />
          <p style={{ fontSize: '1.0625rem', lineHeight: 1.8 }}>{t('home.ribe_text')}</p>
        </div>
      </section>
    </Layout>
  );
}
