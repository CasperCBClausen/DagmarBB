import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';

export default function HomePage() {
  const { t } = useTranslation();

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
      }}>
        <div style={{ maxWidth: '700px' }}>
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

      {/* Ribe section */}
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
    </Layout>
  );
}
