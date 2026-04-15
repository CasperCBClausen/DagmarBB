import React from 'react';

interface DatePickerInputProps {
  value: string;       // YYYY-MM-DD
  min?: string;        // YYYY-MM-DD
  lang: string;
  onChange: (val: string) => void;
  required?: boolean;
}

export function DatePickerInput({ value, min, lang, onChange, required }: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const selected = value ? new Date(value + 'T00:00:00') : null;
  const minDate = min ? new Date(min + 'T00:00:00') : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = React.useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(selected?.getMonth() ?? today.getMonth());

  // Sync calendar view when value changes
  React.useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Weekday headers Mon–Sun (Jan 1–7 2024 is Mon–Sun)
  const weekdays = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, i + 1)));
  }, [lang]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' });

  // Build calendar grid (Monday-start)
  const firstDayOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(d.toISOString().slice(0, 10));
    setOpen(false);
  };

  const displayValue = selected
    ? selected.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Hidden native input for form validation */}
      {required && (
        <input
          type="text"
          value={value}
          required
          readOnly
          tabIndex={-1}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
      )}

      {/* Trigger */}
      <div
        className="input-field"
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(o => !o)}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ color: displayValue ? 'var(--color-text)' : '#aaa' }}>
          {displayValue || '–'}
        </span>
        <span style={{ color: '#aaa', fontSize: '0.75rem', marginLeft: '0.5rem' }}>▾</span>
      </div>

      {/* Calendar dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          backgroundColor: 'var(--color-bg, #fff)',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '8px',
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          padding: '1rem',
          minWidth: '260px',
        }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <button type="button" onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.625rem', fontSize: '1.125rem', color: 'var(--color-text, #333)', lineHeight: 1 }}>
              ‹
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', textTransform: 'capitalize' }}>
              {monthLabel}
            </span>
            <button type="button" onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.625rem', fontSize: '1.125rem', color: 'var(--color-text, #333)', lineHeight: 1 }}>
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '0.25rem' }}>
            {weekdays.map((wd, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: '#aaa', padding: '0.2rem 0', textTransform: 'capitalize' }}>
                {wd}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const cellDate = new Date(viewYear, viewMonth, day);
              const isSelected = selected?.toDateString() === cellDate.toDateString();
              const isDisabled = !!minDate && cellDate < minDate;
              const isToday = today.toDateString() === cellDate.toDateString();
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDay(day)}
                  style={{
                    padding: '0.375rem 0',
                    borderRadius: '50%',
                    border: isToday && !isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                    color: isSelected ? '#fff' : isDisabled ? '#ccc' : 'var(--color-text, #333)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'center',
                    width: '100%',
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
