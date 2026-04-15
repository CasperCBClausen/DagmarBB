import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';

const BASE = import.meta.env.BASE_URL; // e.g. '/' locally, '/DagmarBB/' on GitHub Pages

const GALLERY_PHOTOS = [
  { src: `${BASE}photos/apartment_livingroom1.jpg`, gridArea: '1 / 1 / 3 / 2' },
  { src: `${BASE}photos/apartment_bedroom1.jpg`,    gridArea: '1 / 2 / 2 / 3' },
  { src: `${BASE}photos/bathroom_firstfloor1.jpg`,  gridArea: '1 / 3 / 2 / 4' },
  { src: `${BASE}photos/room1.jpg`,                 gridArea: '2 / 2 / 3 / 3' },
  { src: `${BASE}photos/hallway1.jpg`,              gridArea: '2 / 3 / 4 / 4' },
  { src: `${BASE}photos/single_bedroom.jpg`,        gridArea: '3 / 1 / 4 / 2' },
  { src: `${BASE}photos/kitchenette1.jpg`,          gridArea: '3 / 2 / 4 / 3' },
  { src: `${BASE}photos/bathroom_secondfloor1.jpg`, gridArea: '4 / 1 / 5 / 2' },
];

export default function HomePage() {
  const { t } = useTranslation();
  const [lightbox, setLightbox] = React.useState<number | null>(null);

  // Keyboard navigation for lightbox
  React.useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(i => i === null ? null : (i + 1) % GALLERY_PHOTOS.length);
      if (e.key === 'ArrowLeft') setLightbox(i => i === null ? null : (i - 1 + GALLERY_PHOTOS.length) % GALLERY_PHOTOS.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  return (
    <Layout>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'white',
        padding: '4rem 1rem',
        overflow: 'hidden',
      }}>
        <img
          src={`${BASE}photos/dagmarbb_view1.jpg`}
          alt="Dagmar B&B"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.6) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '700px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, marginBottom: '1.25rem', color: 'white' }}>
            {t('home.hero_title')}
          </h1>
          <p style={{ fontSize: '1.125rem', marginBottom: '2.5rem', opacity: 0.9, lineHeight: 1.7 }}>
            {t('home.hero_subtitle')}
          </p>
          <Link to="/book" className="btn-primary" style={{ fontSize: '1.0625rem', padding: '0.875rem 2.5rem', backgroundColor: 'white', color: 'var(--color-primary)' }}>
            {t('nav.book')}
          </Link>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '5rem 1rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.25rem', color: 'var(--color-primary)' }}>
          {t('home.about_title')}
        </h2>
        <hr />
        <p style={{ fontSize: '1.0625rem', lineHeight: 1.8, color: 'var(--color-text)' }}>
          {t('home.about_text')}
        </p>
      </section>

      {/* ── Photo gallery ────────────────────────────────────────────────── */}
      <section style={{ padding: '0 1rem 5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--color-primary)', textAlign: 'center', marginBottom: '0.5rem' }}>
          {t('home.gallery_title')}
        </h2>
        <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9375rem', marginBottom: '1.75rem' }}>
          {t('home.gallery_subtitle')}
        </p>

        {/* Desktop mosaic grid */}
        <div className="gallery-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(4, 220px)',
          gap: '8px',
        }}>
          {GALLERY_PHOTOS.map((photo, idx) => (
            <button
              key={idx}
              onClick={() => setLightbox(idx)}
              style={{
                gridArea: photo.gridArea,
                padding: 0,
                border: 'none',
                cursor: 'pointer',
                overflow: 'hidden',
                borderRadius: '4px',
                display: 'block',
              }}
            >
              <img
                src={photo.src}
                alt=""
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.35s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            </button>
          ))}
        </div>

        {/* Mobile scrollable strip */}
        <div className="gallery-strip" style={{ display: 'none', gap: '8px', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {GALLERY_PHOTOS.map((photo, idx) => (
            <button
              key={idx}
              onClick={() => setLightbox(idx)}
              style={{ flexShrink: 0, width: '72vw', height: '52vw', padding: 0, border: 'none', cursor: 'pointer', borderRadius: '6px', overflow: 'hidden' }}
            >
              <img src={photo.src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      </section>

      {/* ── Ribe section ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--color-surface)', padding: '5rem 1rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '1.25rem', color: 'var(--color-primary)' }}>
            {t('home.ribe_title')}
          </h2>
          <hr />
          <p style={{ fontSize: '1.0625rem', lineHeight: 1.8 }}>{t('home.ribe_text')}</p>
          <Link to="/book" className="btn-primary" style={{ display: 'inline-block', marginTop: '2rem' }}>
            {t('nav.book')}
          </Link>
        </div>
      </section>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Prev */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(i => i === null ? null : (i - 1 + GALLERY_PHOTOS.length) % GALLERY_PHOTOS.length); }}
            style={{ position: 'absolute', left: '1rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '2rem', width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >‹</button>

          {/* Image */}
          <img
            src={GALLERY_PHOTOS[lightbox].src}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
          />

          {/* Next */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(i => i === null ? null : (i + 1) % GALLERY_PHOTOS.length); }}
            style={{ position: 'absolute', right: '1rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '2rem', width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >›</button>

          {/* Close */}
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.25rem', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>

          {/* Counter */}
          <div style={{ position: 'absolute', bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
            {lightbox + 1} / {GALLERY_PHOTOS.length}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .gallery-grid { display: none !important; }
          .gallery-strip { display: flex !important; }
        }
      `}</style>
    </Layout>
  );
}
