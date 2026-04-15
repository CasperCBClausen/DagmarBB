import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../hooks/useApi';
import type { Booking } from '@dagmar/shared';

function fmt(n: number) {
  return n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiClient.get<Booking>(`/bookings/${id}`)
      .then(res => setBooking(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div>;
  if (!booking) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>{t('admin.booking_not_found')}</div>;

  const today = new Date().toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 2cm; }
        }
      `}</style>

      <div className="no-print" style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 100 }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: 'var(--color-primary, #8B4513)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {t('admin.print_invoice')} 🖨
        </button>
      </div>

      <div style={{ maxWidth: '720px', margin: '2rem auto', padding: '2.5rem', fontFamily: 'Arial, sans-serif', color: '#1a1a1a', fontSize: '0.9375rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '2px solid #1a1a1a' }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '2rem', margin: '0 0 0.5rem' }}>Dagmar B&B</h1>
            <div style={{ fontSize: '0.875rem', color: '#555', lineHeight: 1.7 }}>
              <div>Sortebrødre Gade, 6760 Ribe</div>
              <div>info@dagmarbb.dk</div>
              <div>+45 12 34 56 78</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '1.5rem', margin: '0 0 0.75rem', color: '#555', fontWeight: 400 }}>
              {t('admin.invoice_title')}
            </h2>
            <div style={{ fontSize: '0.875rem', lineHeight: 1.8 }}>
              <div><strong>{t('admin.invoice_number')}:</strong> {booking.bookingRef}</div>
              <div><strong>{t('admin.invoice_date')}:</strong> {today}</div>
              <div><strong>{t('admin.due_date')}:</strong> {fmtDate(booking.checkOut)}</div>
            </div>
          </div>
        </div>

        {/* Bill to */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '0.5rem' }}>
            {t('admin.invoice_bill_to')}
          </div>
          <div style={{ lineHeight: 1.7 }}>
            <div><strong>{booking.guestName}</strong></div>
            <div style={{ color: '#555' }}>{booking.guestEmail}</div>
            {booking.guestPhone && <div style={{ color: '#555' }}>{booking.guestPhone}</div>}
          </div>
        </div>

        {/* Stay summary */}
        <div style={{ marginBottom: '2rem', padding: '0.875rem 1rem', backgroundColor: '#f8f8f8', borderRadius: '4px', fontSize: '0.875rem', color: '#555' }}>
          {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)} · {booking.nights} {t('my_booking.nights')}
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem 0', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', fontWeight: 600 }}>
                {t('admin.line_items')}
              </th>
              <th style={{ textAlign: 'right', padding: '0.5rem 0', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', fontWeight: 600 }}>
                DKK
              </th>
            </tr>
          </thead>
          <tbody>
            {booking.bookingRooms?.map(br => {
              const roomNightsCost = br.pricePerNight * booking.nights;
              const impliedCharges = br.subtotal - roomNightsCost;
              const categoryName = br.roomCategory?.name ?? t('admin.col_room');
              return (
                <React.Fragment key={br.id}>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.875rem 0' }}>
                      {categoryName} &times; {booking.nights} {t('my_booking.nights')} @ {fmt(br.pricePerNight)} kr./nat
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.875rem 0' }}>{fmt(roomNightsCost)}</td>
                  </tr>
                  {impliedCharges > 0.01 && (
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '0.875rem 0', color: '#555' }}>{t('admin.additional_services')}</td>
                      <td style={{ textAlign: 'right', padding: '0.875rem 0', color: '#555' }}>{fmt(impliedCharges)}</td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {(booking.discountAmount ?? 0) > 0 && (
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.875rem 0', color: '#15803d' }}>
                  {t('admin.discount_line', { percent: booking.discountPercent, code: booking.discountCode })}
                </td>
                <td style={{ textAlign: 'right', padding: '0.875rem 0', color: '#15803d' }}>
                  -{fmt(booking.discountAmount!)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #1a1a1a' }}>
              <td style={{ padding: '1rem 0', fontWeight: 700, fontSize: '1.0625rem' }}>{t('admin.total')}</td>
              <td style={{ textAlign: 'right', padding: '1rem 0', fontWeight: 700, fontSize: '1.0625rem' }}>
                {fmt(booking.totalPrice)} DKK
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #e0e0e0', fontSize: '0.8125rem', color: '#888', lineHeight: 1.6 }}>
          {t('admin.invoice_footer')}
        </div>
      </div>
    </>
  );
}
