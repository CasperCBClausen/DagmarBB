import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from './AdminLayout';
import { apiClient } from '../../hooks/useApi';
import type { Room, Booking } from '@dagmar/shared';

type RoomForm = {
  name: string;
  description: string;
  pricePerNight: string;
  maxGuests: string;
  amenities: string;
  isActive: boolean;
};

const emptyForm: RoomForm = {
  name: '', description: '', pricePerNight: '', maxGuests: '2', amenities: '', isActive: true,
};

function toSlug(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const statusColors: Record<string, string> = {
  PENDING: '#f59e0b', CONFIRMED: '#10b981', CHECKED_IN: '#3b82f6',
  CHECKED_OUT: '#6b7280', CANCELLED: '#ef4444', NO_SHOW: '#9ca3af',
};

export default function AdministrationPage() {
  const { t } = useTranslation();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [qrModal, setQrModal] = React.useState<{ roomId: string; name: string; qrDataUrl: string } | null>(null);
  const [roomModal, setRoomModal] = React.useState<{ mode: 'add' | 'edit'; room?: Room } | null>(null);
  const [form, setForm] = React.useState<RoomForm>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  const loadData = () => {
    Promise.all([
      apiClient.get<Room[]>('/rooms/all').then(r => setRooms(r.data)),
      apiClient.get<Booking[]>('/bookings').then(r => setBookings(r.data)),
    ]).finally(() => setLoading(false));
  };

  React.useEffect(() => { loadData(); }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setFormError('');
    setRoomModal({ mode: 'add' });
  };

  const openEdit = (room: Room) => {
    setForm({
      name: room.name,
      description: room.description,
      pricePerNight: room.pricePerNight.toString(),
      maxGuests: room.maxGuests.toString(),
      amenities: room.amenities.join(', '),
      isActive: room.isActive,
    });
    setFormError('');
    setRoomModal({ mode: 'edit', room });
  };

  const saveRoom = async () => {
    setSaving(true);
    setFormError('');
    const name = form.name.trim();
    const basePayload = {
      name,
      description: form.description.trim(),
      pricePerNight: parseFloat(form.pricePerNight),
      maxGuests: parseInt(form.maxGuests),
      amenities: form.amenities.split(',').map(a => a.trim()).filter(Boolean),
      isActive: form.isActive,
    };
    try {
      if (roomModal?.mode === 'add') {
        await apiClient.post('/rooms', { ...basePayload, slug: toSlug(name) });
      } else if (roomModal?.room) {
        await apiClient.patch(`/rooms/${roomModal.room.id}`, basePayload);
      }
      setRoomModal(null);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Kunne ikke gemme værelset.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (room: Room) => {
    await apiClient.patch(`/rooms/${room.id}`, { isActive: !room.isActive });
    loadData();
  };

  const showQR = async (roomId: string, name: string) => {
    const res = await apiClient.get<{ qrDataUrl: string }>(`/rooms/${roomId}/qr`);
    setQrModal({ roomId, name, qrDataUrl: res.data.qrDataUrl });
  };

  const updateBookingStatus = async (id: string, status: string) => {
    await apiClient.patch(`/bookings/${id}/status`, { status });
    loadData();
  };

  if (loading) return <AdminLayout><div style={{ padding: '4rem', textAlign: 'center' }}>{t('common.loading')}</div></AdminLayout>;

  return (
    <AdminLayout>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', marginBottom: '2rem' }}>
        {t('admin.administration')}
      </h1>

      {/* Rooms section */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>{t('admin.rooms')}</h2>
          <button onClick={openAdd} className="btn-primary" style={{ fontSize: '0.875rem' }}>
            + {t('admin.add_room')}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {rooms.map(room => (
            <div key={room.id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem' }}>{room.name}</h3>
                <span style={{
                  fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '3px',
                  backgroundColor: room.isActive ? '#d1fae5' : '#fee2e2',
                  color: room.isActive ? '#065f46' : '#991b1b',
                }}>
                  {room.isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                {room.pricePerNight.toLocaleString('da-DK')} DKK / nat · op til {room.maxGuests} gæster
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '1rem', lineHeight: 1.5 }}>
                {room.description.slice(0, 80)}...
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => openEdit(room)} className="btn-primary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
                  {t('common.edit')}
                </button>
                <button onClick={() => showQR(room.id, room.name)} className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
                  {t('admin.view_qr')}
                </button>
                <button
                  onClick={() => toggleActive(room)}
                  style={{ fontSize: '0.8125rem', padding: '0.3125rem 0.75rem', border: '1px solid #e0e0e0', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer', color: '#666' }}
                >
                  {room.isActive ? 'Deaktiver' : 'Aktiver'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bookings section */}
      <section>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.25rem' }}>{t('admin.all_bookings')}</h2>
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)', backgroundColor: 'var(--color-bg)' }}>
                {['Ref', 'Gæst', 'Værelse', 'Ankomst', 'Afrejse', 'Total', 'Status', 'Handlinger'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8125rem', color: '#666', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{b.bookingRef}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div>{b.guestName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{b.guestEmail}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.room?.name}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{new Date(b.checkIn).toLocaleDateString('da-DK')}</td>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{new Date(b.checkOut).toLocaleDateString('da-DK')}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{b.totalPrice.toLocaleString('da-DK')} DKK</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: '3px', backgroundColor: `${statusColors[b.status]}22`, color: statusColors[b.status], fontWeight: 500 }}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <select value={b.status} onChange={e => updateBookingStatus(b.id, e.target.value)}
                      style={{ fontSize: '0.8125rem', padding: '0.25rem', border: '1px solid #e0e0e0', borderRadius: '3px', cursor: 'pointer' }}>
                      {['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Ingen bookinger endnu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Room add/edit modal */}
      {roomModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              {roomModal.mode === 'add' ? t('admin.add_room') : `Rediger: ${roomModal.room?.name}`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Navn *</label>
                <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>Beskrivelse *</label>
                <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Pris pr. nat (DKK) *</label>
                  <input className="input-field" type="number" value={form.pricePerNight} onChange={e => setForm(f => ({ ...f, pricePerNight: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Maks. gæster *</label>
                  <input className="input-field" type="number" value={form.maxGuests} onChange={e => setForm(f => ({ ...f, maxGuests: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Faciliteter <span style={{ color: '#aaa', fontWeight: 400 }}>(kommasepareret)</span></label>
                <input className="input-field" value={form.amenities} onChange={e => setForm(f => ({ ...f, amenities: e.target.value }))} placeholder="WiFi, Parkering, Morgenmad" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                <label htmlFor="isActive" style={{ fontSize: '0.9375rem', cursor: 'pointer' }}>Aktivt værelse (vises på hjemmesiden)</label>
              </div>

              {formError && (
                <p style={{ color: '#c0392b', fontSize: '0.875rem', padding: '0.625rem', backgroundColor: '#fdf0ef', borderRadius: '4px' }}>{formError}</p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button onClick={() => setRoomModal(null)} className="btn-secondary">{t('common.cancel')}</button>
                <button onClick={saveRoom} className="btn-primary" disabled={saving}>
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '1rem' }}>QR-kode: {qrModal.name}</h3>
            <img src={qrModal.qrDataUrl} alt="QR Code" style={{ maxWidth: '250px', margin: '0 auto 1.25rem' }} />
            <p style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '1.5rem' }}>
              Udskriv og placer i værelset til rengøringspersonalets brug.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <a href={qrModal.qrDataUrl} download={`qr-${qrModal.name}.png`} className="btn-primary" style={{ fontSize: '0.875rem' }}>Download</a>
              <button onClick={() => setQrModal(null)} className="btn-secondary" style={{ fontSize: '0.875rem' }}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500,
};
