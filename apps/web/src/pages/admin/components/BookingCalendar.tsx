import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Booking } from '@dagmar/shared';

interface BookingCalendarProps {
  bookings: Booking[];
  targetDate?: Date | null;
  highlightedBookingId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#10b981',
  CHECKED_IN: '#3b82f6',
  CHECKED_OUT: '#6b7280',
  CANCELLED: '#ef4444',
  CUSTOMER_CANCELLED: '#f97316',
  NO_SHOW: '#9ca3af',
};

// Day names generated at render time using Intl (locale-aware)

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday=0 ordering
  return day === 0 ? 6 : day - 1;
}

interface BookingPopover {
  booking: Booking;
  x: number;
  y: number;
}

export function BookingCalendar({ bookings, targetDate, highlightedBookingId }: BookingCalendarProps) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const [popover, setPopover] = React.useState<BookingPopover | null>(null);

  // Navigate to targetDate when it changes
  React.useEffect(() => {
    if (targetDate) {
      setYear(targetDate.getFullYear());
      setMonth(targetDate.getMonth());
    }
  }, [targetDate]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Locale-aware month and day names via Intl
  const monthName = new Date(year, month, 1).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  // Monday-first day names: 2024-01-01 is a Monday
  const DAY_NAMES = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, i + 1).toLocaleDateString(i18n.language, { weekday: 'short' })
  );

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  interface CalendarEntry {
    booking: Booking;
    label: string;
    entryKey: string;
  }

  // Get per-BookingRoom entries that overlap a given day
  const getEntriesForDay = (day: number): CalendarEntry[] => {
    const date = new Date(year, month, day);
    const nextDay = new Date(year, month, day + 1);
    const entries: CalendarEntry[] = [];
    bookings
      .filter(b => {
        if (['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'].includes(b.status)) return false;
        const checkIn = new Date(b.checkIn);
        const checkOut = new Date(b.checkOut);
        return checkIn < nextDay && checkOut > date;
      })
      .forEach(b => {
        if (b.bookingRooms && b.bookingRooms.length > 0) {
          b.bookingRooms.forEach((br, idx) => {
            entries.push({
              booking: b,
              label: br.assignedRoom?.name ?? br.room?.name ?? br.roomCategory?.name ?? '?',
              entryKey: `${b.id}-${br.id ?? idx}`,
            });
          });
        } else {
          entries.push({
            booking: b,
            label: b.room?.name ?? b.assignedRoom?.name ?? '?',
            entryKey: b.id,
          });
        }
      });
    return entries;
  };

  // Total cells: pad with empty cells before the 1st
  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  return (
    <div style={{ position: 'relative' }} onClick={() => setPopover(null)}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={prevMonth} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '0.25rem 0.75rem', cursor: 'pointer', background: 'none' }}>
          ←
        </button>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', color: 'var(--color-primary)', textTransform: 'capitalize' }}>
          {monthName}
        </h3>
        <button onClick={nextMonth} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '0.25rem 0.75rem', cursor: 'pointer', background: 'none' }}>
          →
        </button>
      </div>

      {/* Status legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.75rem' }}>
        {Object.entries(STATUS_COLORS).filter(([s]) => !['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'].includes(s)).map(([status, color]) => (
          <span key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
            {t(`booking_status.${status}`, { defaultValue: status })}
          </span>
        ))}
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#888', padding: '0.375rem 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {Array.from({ length: rows * 7 }, (_, i) => {
          const day = i - firstDay + 1;
          const isValid = day >= 1 && day <= daysInMonth;
          const dayEntries = isValid ? getEntriesForDay(day) : [];
          const isToday = isValid && year === now.getFullYear() && month === now.getMonth() && day === now.getDate();

          return (
            <div key={i} style={{
              minHeight: '72px',
              backgroundColor: isValid ? 'white' : '#f9f9f9',
              border: `1px solid ${isToday ? 'var(--color-primary)' : '#e5e7eb'}`,
              borderRadius: '4px',
              padding: '0.25rem',
              fontSize: '0.75rem',
            }}>
              {isValid && (
                <>
                  <div style={{
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--color-primary)' : '#333',
                    marginBottom: '0.25rem',
                  }}>
                    {day}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {dayEntries.slice(0, 5).map(({ booking: b, label, entryKey }) => {
                      const isHighlighted = highlightedBookingId === b.id;
                      return (
                        <div
                          key={entryKey}
                          onClick={e => {
                            e.stopPropagation();
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            setPopover({ booking: b, x: rect.left, y: rect.bottom + 4 });
                          }}
                          title={`${label} — ${b.guestName} (${b.bookingRef})`}
                          style={{
                            backgroundColor: isHighlighted ? STATUS_COLORS[b.status] + '88' : STATUS_COLORS[b.status] + '33',
                            borderLeft: `3px solid ${STATUS_COLORS[b.status]}`,
                            borderRadius: '2px',
                            padding: '1px 3px',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            color: '#333',
                            outline: isHighlighted ? `2px solid ${STATUS_COLORS[b.status]}` : 'none',
                          }}
                        >
                          {label} · {b.guestName.split(' ')[0]}
                        </div>
                      );
                    })}
                    {dayEntries.length > 5 && (
                      <div style={{ fontSize: '0.7rem', color: '#888' }}>{t('admin.more_entries', { count: dayEntries.length - 5 })}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Popover */}
      {popover && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(popover.x, window.innerWidth - 280),
            top: popover.y,
            zIndex: 2000,
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            padding: '1rem',
            minWidth: '240px',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <strong>{popover.booking.guestName}</strong>
            <button onClick={() => setPopover(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '1rem' }}>×</button>
          </div>
          <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{popover.booking.guestEmail}</div>
          <div style={{ marginBottom: '0.375rem' }}>
            <strong>{t('admin.col_ref')}:</strong> <span style={{ fontFamily: 'monospace' }}>{popover.booking.bookingRef}</span>
          </div>
          <div style={{ marginBottom: '0.375rem' }}>
            <strong>{t('admin.col_room')}:</strong> {popover.booking.room?.name ?? popover.booking.assignedRoom?.name ?? t('admin.not_assigned')}
          </div>
          <div style={{ marginBottom: '0.375rem' }}>
            <strong>{t('admin.col_arrival')}:</strong> {new Date(popover.booking.checkIn).toLocaleDateString(i18n.language)}
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>{t('admin.col_departure')}:</strong> {new Date(popover.booking.checkOut).toLocaleDateString(i18n.language)}
          </div>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '3px',
            backgroundColor: (STATUS_COLORS[popover.booking.status] ?? '#888') + '22',
            color: STATUS_COLORS[popover.booking.status] ?? '#888',
            fontWeight: 500,
          }}>
            {t(`booking_status.${popover.booking.status}`, { defaultValue: popover.booking.status })}
          </span>
        </div>
      )}
    </div>
  );
}
