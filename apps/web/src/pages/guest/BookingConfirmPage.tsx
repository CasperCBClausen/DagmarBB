import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';
import { apiClient } from '../../hooks/useApi';
import type { Booking } from '@dagmar/shared';

export default function BookingConfirmPage() {
  const { ref } = useParams<{ ref: string }>();
  const { t } = useTranslation();
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!ref) return;
    apiClient.get<Booking>(`/bookings/ref/${ref}`)
      .then(r => setBooking(r.data))
      .finally(() => setLoading(false));
  }, [ref]);

  if (loading) return <Layout><div style={{ padding: '8rem', textAlign: 'center' }}>{t('common.loading')}</div></Layout>;
  if (!booking) return <Layout><div style={{ padding: '8rem', textAlign: 'center' }}>{t('common.error')}</div></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✓</div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '0.75rem' }}>
          {t('confirm.title')}
        </h1>
        <p style={{ color: '#666', marginBottom: '2.5rem' }}>{t('confirm.subtitle')}</p>

        <div className="card" style={{ padding: '2rem', textAlign: 'left', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            {[
              [t('confirm.ref'), booking.bookingRef],
              ['Værelse', booking.room?.name],
              [t('confirm.check_in'), new Date(booking.checkIn).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
              [t('confirm.check_out'), new Date(booking.checkOut).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
              [t('confirm.total'), `${booking.totalPrice.toLocaleString('da-DK')} DKK`],
            ].map(([label, value]) => (
              <tr key={label} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <td style={{ padding: '0.75rem 0', fontWeight: 500, color: '#666', fontSize: '0.875rem', width: '40%' }}>{label}</td>
                <td style={{ padding: '0.75rem 0', color: 'var(--color-text)' }}>{value}</td>
              </tr>
            ))}
          </table>
        </div>

        <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '2rem' }}>{t('confirm.check_email')}</p>
        <Link to="/" className="btn-primary">{t('confirm.back_home')}</Link>
      </div>
    </Layout>
  );
}
