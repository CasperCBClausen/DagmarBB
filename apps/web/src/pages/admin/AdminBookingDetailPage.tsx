import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from './AdminLayout';
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
  CHECKED_OUT: '#6b7280', CANCELLED: '#ef4444', CUSTOMER_CANCELLED: '#f97316', NO_SHOW: '#9ca3af',
};

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500,
};

export default function AdminBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Guest info editing
  const [guestName, setGuestName] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [savingInfo, setSavingInfo] = React.useState(false);
  const [infoSaved, setInfoSaved] = React.useState(false);

  // Status change
  const [savingStatus, setSavingStatus] = React.useState(false);

  // Messages
  const [messages, setMessages] = React.useState<BookingMessage[]>([]);
  const [msgText, setMsgText] = React.useState('');
  const [sendingMsg, setSendingMsg] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const loadBooking = async () => {
    try {
      const res = await apiClient.get<Booking>(`/bookings/${id}`);
      setBooking(res.data);
      setGuestName(res.data.guestName);
      setGuestEmail(res.data.guestEmail);
      setGuestPhone(res.data.guestPhone ?? '');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const res = await apiClient.get<BookingMessage[]>(`/bookings/${id}/messages`);
      setMessages(res.data);
    } catch {}
  };

  React.useEffect(() => {
    loadBooking();
    loadMessages();
  }, [id]);

  React.useEffect(() => {
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [id]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveInfo = async () => {
    if (!booking) return;
    setSavingInfo(true);
    setInfoSaved(false);
    try {
      const res = await apiClient.patch<Booking>(`/bookings/ref/${booking.bookingRef}/guest`, {
        guestName, guestEmail, guestPhone: guestPhone || undefined,
      });
      setBooking(prev => prev ? { ...prev, ...res.data } : prev);
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 3000);
    } finally {
      setSavingInfo(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!booking) return;
    setSavingStatus(true);
    try {
      await apiClient.patch(`/bookings/${booking.id}/status`, { status });
      setBooking(prev => prev ? { ...prev, status: status as any } : prev);
    } finally {
      setSavingStatus(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    setSendingMsg(true);
    try {
      await apiClient.post(`/bookings/${id}/messages`, { text: msgText.trim() });
      setMsgText('');
      await loadMessages();
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) return <AdminLayout><div style={{ padding: '4rem', textAlign: 'center' }}>{t('common.loading')}</div></AdminLayout>;
  if (!booking) return <AdminLayout><div style={{ padding: '4rem', textAlign: 'center', color: '#888' }}>{t('admin.booking_not_found')}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/admin/administration')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.875rem', padding: 0 }}>
            ← {t('admin.all_bookings')}
          </button>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', margin: 0 }}>
            {booking.bookingRef}
          </h1>
          <span style={{ fontSize: '0.8125rem', padding: '0.3rem 0.75rem', borderRadius: '4px', backgroundColor: `${statusColors[booking.status] ?? '#888'}22`, color: statusColors[booking.status] ?? '#888', fontWeight: 600 }}>
            {t(`booking_status.${booking.status}`, { defaultValue: booking.status })}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Booking details */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', marginBottom: '1rem' }}>{t('my_booking.booking_details')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
              <div><span style={{ color: '#888' }}>{t('my_booking.check_in')}:</span> <strong>{new Date(booking.checkIn).toLocaleDateString()}</strong></div>
              <div><span style={{ color: '#888' }}>{t('my_booking.check_out')}:</span> <strong>{new Date(booking.checkOut).toLocaleDateString()}</strong></div>
              <div><span style={{ color: '#888' }}>{t('my_booking.nights')}:</span> <strong>{booking.nights}</strong></div>
              <div><span style={{ color: '#888' }}>{t('my_booking.total')}:</span> <strong>{booking.totalPrice.toLocaleString('da-DK')} DKK</strong></div>
              {booking.discountCode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem', backgroundColor: '#f0fdf4', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#15803d', fontWeight: 600 }}>-{booking.discountPercent}%</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: '#15803d' }}>{booking.discountCode}</span>
                  <span style={{ fontSize: '0.8125rem', color: '#888', marginLeft: 'auto' }}>-{booking.discountAmount?.toLocaleString('da-DK')} DKK</span>
                </div>
              )}
              {booking.bookingRooms?.map(br => (
                <div key={br.id} style={{ fontSize: '0.8125rem', color: '#555' }}>
                  {br.roomCategory?.name}{br.assignedRoom || br.room ? ` → ${(br.assignedRoom ?? br.room)?.name}` : ` (${t('admin.not_assigned')})`}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              <label style={labelStyle}>{t('admin.col_status')}</label>
              <select
                value={booking.status}
                onChange={e => updateStatus(e.target.value)}
                disabled={savingStatus}
                style={{ padding: '0.4rem 0.75rem', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '0.875rem', cursor: 'pointer', width: '100%' }}
              >
                {['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'].map(s => (
                  <option key={s} value={s}>{t(`booking_status.${s}`, { defaultValue: s })}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Guest info */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', marginBottom: '1rem' }}>{t('my_booking.your_info')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
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
                <input className="input-field" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={saveInfo} className="btn-primary" disabled={savingInfo} style={{ fontSize: '0.875rem' }}>
                  {savingInfo ? '...' : t('my_booking.save_info')}
                </button>
                {infoSaved && <span style={{ color: '#10b981', fontSize: '0.8125rem' }}>✓ {t('my_booking.info_saved')}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', marginBottom: '1.25rem' }}>{t('my_booking.messages_title')}</h2>
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {messages.length === 0 && (
              <p style={{ color: '#aaa', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>{t('my_booking.messages_empty')}</p>
            )}
            {messages.map(msg => {
              const isAdmin = msg.senderRole === 'admin';
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: isAdmin ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    backgroundColor: isAdmin ? 'var(--color-primary)' : 'rgba(0,0,0,0.06)',
                    color: isAdmin ? 'white' : 'var(--color-text)',
                    fontSize: '0.9375rem',
                    lineHeight: 1.5,
                  }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '0.25rem' }}>
                    {isAdmin ? (msg.senderName ?? t('my_booking.messages_host')) : (msg.senderName ?? t('my_booking.messages_you'))}
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
      </div>
    </AdminLayout>
  );
}
