import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';
import { apiClient } from '../../hooks/useApi';
import type { Room, Booking } from '@dagmar/shared';

export default function BookingPage() {
  const { roomSlug } = useParams<{ roomSlug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [room, setRoom] = React.useState<Room | null>(null);
  const [bookingMode, setBookingMode] = React.useState<'manual' | 'autonomous'>('manual');
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [form, setForm] = React.useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkIn: today,
    checkOut: tomorrow,
    notes: '',
    paymentMethod: 'MOBILEPAY' as 'MOBILEPAY' | 'FLATPAY',
  });

  React.useEffect(() => {
    if (!roomSlug) return;
    Promise.all([
      apiClient.get<Room>(`/rooms/${roomSlug}`),
      apiClient.get<{ bookingMode: 'manual' | 'autonomous' }>('/settings'),
    ])
      .then(([roomRes, settingsRes]) => {
        setRoom(roomRes.data);
        setBookingMode(settingsRes.data.bookingMode);
      })
      .finally(() => setLoading(false));
  }, [roomSlug]);

  const nights = Math.max(0, Math.ceil((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    setSubmitting(true);
    setError(null);

    try {
      const bookingRes = await apiClient.post<Booking>('/bookings', {
        roomId: room.id,
        ...form,
      });

      const booking = bookingRes.data;

      const endpoint = form.paymentMethod === 'MOBILEPAY' ? '/payments/mobilepay/initiate' : '/payments/flatpay/initiate';
      const payRes = await apiClient.post<{ redirectUrl: string }>(endpoint, { bookingId: booking.id });

      window.location.href = payRes.data.redirectUrl;
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
      setSubmitting(false);
    }
  };

  if (loading) return <Layout><div style={{ padding: '8rem', textAlign: 'center' }}>{t('common.loading')}</div></Layout>;
  if (!room) return <Layout><div style={{ padding: '8rem', textAlign: 'center' }}>{t('common.error')}</div></Layout>;

  // Manual mode — show contact card instead of booking form
  if (bookingMode === 'manual') {
    return (
      <Layout>
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '4rem 1rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.875rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
            {room.name}
          </h1>
          <div className="card" style={{ padding: '2.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem', marginBottom: '0.75rem' }}>
              {t('booking.contact_mode_title')}
            </h2>
            <p style={{ color: '#666', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              {t('booking.contact_mode_text')}
            </p>
            <a
              href={`mailto:${t('booking.contact_email')}?subject=Booking inquiry — ${room.name}`}
              className="btn-primary"
              style={{ fontSize: '1rem', padding: '0.875rem 2rem', display: 'inline-block', textDecoration: 'none' }}
            >
              {t('booking.contact_email')}
            </a>
            <div style={{ marginTop: '1.5rem' }}>
            </div>
          </div>
          <Link to="/rooms" style={{ display: 'inline-block', marginTop: '1.5rem', color: 'var(--color-accent)', fontSize: '0.875rem' }}>
            ← {t('rooms.title')}
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 1rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.875rem', color: 'var(--color-primary)', marginBottom: '2rem' }}>
          {t('booking.title', { room: room.name })}
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'start' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  {t('booking.check_in')}
                </label>
                <input type="date" className="input-field" value={form.checkIn} min={today}
                  onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  {t('booking.check_out')}
                </label>
                <input type="date" className="input-field" value={form.checkOut} min={form.checkIn}
                  onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} required />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                {t('booking.guest_name')} *
              </label>
              <input type="text" className="input-field" value={form.guestName}
                onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} required />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                {t('booking.guest_email')} *
              </label>
              <input type="email" className="input-field" value={form.guestEmail}
                onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))} required />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                {t('booking.guest_phone')}
              </label>
              <input type="tel" className="input-field" value={form.guestPhone}
                onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                {t('booking.payment_method')}
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {(['MOBILEPAY', 'FLATPAY'] as const).map(method => (
                  <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.75rem 1rem', border: `2px solid ${form.paymentMethod === method ? 'var(--color-primary)' : '#e0e0e0'}`, borderRadius: '6px', flex: 1 }}>
                    <input type="radio" name="payment" value={method} checked={form.paymentMethod === method}
                      onChange={() => setForm(f => ({ ...f, paymentMethod: method }))} />
                    <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                      {method === 'MOBILEPAY' ? '📱 ' + t('booking.mobilepay') : '💳 ' + t('booking.flatpay')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                {t('booking.notes')}
              </label>
              <textarea className="input-field" rows={3} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ resize: 'vertical' }} />
            </div>

            {error && (
              <p style={{ color: '#c0392b', fontSize: '0.875rem', padding: '0.75rem', backgroundColor: '#fdf0ef', borderRadius: '4px' }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary" disabled={submitting || nights < 1} style={{ padding: '0.875rem', fontSize: '1rem' }}>
              {submitting ? t('common.loading') : t('booking.proceed_payment')}
            </button>
          </form>

          {/* Price summary */}
          <div className="card" style={{ padding: '1.5rem', minWidth: '200px', position: 'sticky', top: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem', fontSize: '1.0625rem' }}>{room.name}</h3>
            <hr />
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              {nights} {t(nights === 1 ? 'booking.nights' : 'booking.nights_plural', { count: nights })}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
