import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <Layout>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 1rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.25rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
          {t('about.title')}
        </h1>
        <hr />

        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>{t('about.history_title')}</h2>
          <p style={{ lineHeight: 1.8, fontSize: '1.0625rem' }}>{t('about.history_text')}</p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>{t('about.ribe_title')}</h2>
          <p style={{ lineHeight: 1.8, fontSize: '1.0625rem' }}>{t('about.ribe_text')}</p>
        </section>

        <section style={{ backgroundColor: 'var(--color-surface)', padding: '2rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1.25rem' }}>{t('about.contact_title')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1.5rem', fontSize: '1rem' }}>
            <span style={{ color: '#888' }}>{t('about.address_label')}:</span>
            <span>{t('about.address')}</span>
            <span style={{ color: '#888' }}>{t('about.email_label')}:</span>
            <a href={`mailto:${t('about.email')}`} style={{ color: 'var(--color-primary)' }}>{t('about.email')}</a>
            <span style={{ color: '#888' }}>{t('about.phone_label')}:</span>
            <a href={`tel:${t('about.phone')}`} style={{ color: 'var(--color-primary)' }}>{t('about.phone')}</a>
          </div>
        </section>
      </div>
    </Layout>
  );
}
