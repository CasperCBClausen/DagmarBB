import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';
import { useConfirm } from '../../components/ConfirmDialog';
import { apiClient } from '../../hooks/useApi';
import type { Booking } from '@dagmar/shared';

interface BookingMessage {
  id: string;
  bookingId: string;
  senderRole: string;
  senderName?: string;
  text: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PENDING: '#f59e0b', CONFIRMED: '#10b981', CHECKED_IN: '#3b82f6',
  CHECKED_OUT: '#6b7280', CANCELLED: '#ef4444', CUSTOMER_CANCELLED: '#ef4444', NO_SHOW: '#9ca3af',
};

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500,
};

function guestStatusLabel(status: string, t: (key: string) => string): string {
  if (status === 'CUSTOMER_CANCELLED') return t('booking_status.cancelled_by_you');
  return t(`booking_status.${status}`);
}

export default function MyBookingPage() {
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [refInput, setRefInput] = React.useState(searchParams.get('ref') ?? '');
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Guest info edit
  const [guestName, setGuestName] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [savingInfo, setSavingInfo] = React.useState(false);
  const [infoSaved, setInfoSaved] = React.useState(false);

  // Cancel
  const [cancelling, setCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState('');

  // Messages
  const [messages, setMessages] = React.useState<BookingMessage[]>([]);
  const [msgText, setMsgText] = React.useState('');
  const [sendingMsg, setSendingMsg] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const shouldScrollRef = React.useRef(false);

  const loadBooking = async (ref: string) => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await apiClient.get<Booking>(`/bookings/ref/${ref.trim().toUpperCase()}`);
      setBooking(res.data);
      setGuestName(res.data.guestName);
      setGuestEmail(res.data.guestEmail);
      setGuestPhone(res.data.guestPhone ?? '');
      setSearchParams({ ref: ref.trim().toUpperCase() }, { replace: true });
      shouldScrollRef.current = true;
      await loadMessages(ref.trim().toUpperCase());
    } catch {
      setNotFound(true);
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ref: string) => {
    try {
      const res = await apiClient.get<BookingMessage[]>(`/bookings/ref/${ref}/messages`);
      setMessages(res.data);
    } catch {}
  };

  // Auto-load if ref in URL on mount
  React.useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) loadBooking(ref);
  }, []);

  // Poll messages every 10s
  React.useEffect(() => {
    if (!booking) return;
    const ref = booking.bookingRef;
    const interval = setInterval(() => loadMessages(ref), 10000);
    return () => clearInterval(interval);
  }, [booking?.bookingRef]);

  // Scroll to bottom only after initial load or after sending a message
  React.useEffect(() => {
    if (shouldScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldScrollRef.current = false;
    }
  }, [messages]);

  const saveInfo = async () => {
    if (!booking) return;
    setSavingInfo(true);
    setInfoSaved(false);
    try {
      const res = await apiClient.patch<Booking>(`/bookings/ref/${booking.bookingRef}/guest`, {
        guestName, guestEmail, guestPhone: guestPhone || undefined,
      });
      setBooking(res.data);
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 3000);
    } finally {
      setSavingInfo(false);
    }
  };

  const cancelBooking = async () => {
    if (!booking || !await confirm({ title: t('my_booking.cancel_booking'), message: t('my_booking.cancel_confirm'), variant: 'danger' })) return;
    setCancelling(true);
    setCancelError('');
    try {
      const res = await apiClient.post<Booking>(`/bookings/ref/${booking.bookingRef}/cancel`, {});
      setBooking(res.data);
    } catch (err: any) {
      setCancelError(err.response?.data?.error ?? t('my_booking.cannot_cancel'));
    } finally {
      setCancelling(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !msgText.trim()) return;
    setSendingMsg(true);
    try {
      await apiClient.post(`/bookings/ref/${booking.bookingRef}/messages`, { text: msgText.trim() });
      setMsgText('');
      shouldScrollRef.current = true;
      await loadMessages(booking.bookingRef);
    } finally {
      setSendingMsg(false);
    }
  };

  const canCancel = booking && ['PENDING', 'CONFIRMED'].includes(booking.status);

  return (
    <Layout>
      {dialog}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem', color: 'var(--color-primary)' }}>
          {t('my_booking.title')}
        </h1>

        {/* Lookup form */}
        {!booking && (
          <div className="card" style={{ padding: '2rem' }}>
            <p style={{ marginBottom: '1.25rem', color: '#666' }}>{t('my_booking.enter_ref')}</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                className="input-field"
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                placeholder={t('my_booking.ref_placeholder')}
                style={{ flex: 1, minWidth: '200px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                onKeyDown={e => e.key === 'Enter' && loadBooking(refInput)}
                autoFocus
              />
              <button
                onClick={() => loadBooking(refInput)}
                className="btn-primary"
                disabled={loading || !refInput.trim()}
              >
                {loading ? '...' : t('my_booking.lookup')}
              </button>
            </div>
            {notFound && (
              <p style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.9rem' }}>{t('my_booking.not_found')}</p>
            )}
          </div>
        )}

        {booking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Booking header */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {booking.bookingRef}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    {new Date(booking.checkIn).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                    {' → '}
                    {new Date(booking.checkOut).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}{booking.nights} {t('my_booking.nights')}
                  </div>
                  <div style={{ marginTop: '0.375rem', fontSize: '0.9375rem', fontWeight: 600 }}>
                    {booking.totalPrice.toLocaleString()} DKK
                  </div>
                </div>
                <span style={{ fontSize: '0.8125rem', padding: '0.3rem 0.75rem', borderRadius: '4px', backgroundColor: `${statusColors[booking.status] ?? '#888'}22`, color: statusColors[booking.status] ?? '#888', fontWeight: 600 }}>
                  {guestStatusLabel(booking.status, t)}
                </span>
              </div>

              {booking.bookingRooms && booking.bookingRooms.length > 0 && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                  {booking.bookingRooms.map(br => (
                    <div key={br.id} style={{ fontSize: '0.875rem', color: '#555' }}>
                      {br.roomCategory?.name ?? '—'}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Guest info */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.25rem' }}>
                {t('my_booking.your_info')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>{t('booking.guest_name')}</label>
                  <input className="input-field" value={guestName} onChange={e => setGuestName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('booking.guest_email')}</label>
                  <input className="input-field" type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('booking.guest_phone')}</label>
                  <input className="input-field" type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button onClick={saveInfo} className="btn-primary" disabled={savingInfo} style={{ fontSize: '0.875rem' }}>
                    {savingInfo ? '...' : t('my_booking.save_info')}
                  </button>
                  {infoSaved && <span style={{ color: '#10b981', fontSize: '0.875rem' }}>✓ {t('my_booking.info_saved')}</span>}
                </div>
              </div>
            </div>

            {/* Cancel */}
            {canCancel && (
              <div className="card" style={{ padding: '1.5rem' }}>
                {cancelError && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{cancelError}</p>}
                <button onClick={cancelBooking} disabled={cancelling} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '5px', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                  {cancelling ? '...' : t('my_booking.cancel_booking')}
                </button>
              </div>
            )}
            {(booking.status === 'CANCELLED' || booking.status === 'CUSTOMER_CANCELLED') && (
              <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#ef4444', fontSize: '0.9rem', textAlign: 'center' }}>
                {booking.status === 'CUSTOMER_CANCELLED' ? t('booking_status.cancelled_by_you') : t('my_booking.cancelled')}
              </div>
            )}

            {/* Chat */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.25rem' }}>
                {t('my_booking.messages_title')}
              </h2>
              <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', paddingRight: '0.25rem' }}>
                {messages.length === 0 && (
                  <p style={{ color: '#aaa', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>{t('my_booking.messages_empty')}</p>
                )}
                {messages.map(msg => {
                  const isGuest = msg.senderRole === 'guest';
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isGuest ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%',
                        padding: '0.625rem 0.875rem',
                        borderRadius: isGuest ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        backgroundColor: isGuest ? 'var(--color-primary)' : 'rgba(0,0,0,0.06)',
                        color: isGuest ? 'white' : 'var(--color-text)',
                        fontSize: '0.9375rem',
                        lineHeight: 1.5,
                      }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '0.25rem' }}>
                        {isGuest ? t('my_booking.messages_you') : (msg.senderName ?? t('my_booking.messages_host'))}
                        {' · '}
                        {new Date(msg.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.625rem' }}>
                <input
                  className="input-field"
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder={t('my_booking.messages_placeholder')}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary" disabled={sendingMsg || !msgText.trim()} style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                  {t('my_booking.messages_send')}
                </button>
              </form>
            </div>

            {/* Search again */}
            <button
              onClick={() => { setBooking(null); setSearchParams({}); setRefInput(''); }}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.875rem', alignSelf: 'center' }}
            >
              ← {t('my_booking.lookup')} {t('my_booking.enter_ref').toLowerCase()}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
