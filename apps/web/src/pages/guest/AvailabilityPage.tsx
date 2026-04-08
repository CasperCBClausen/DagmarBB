import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '../../components/Layout';
import { CurrencyConverter } from '../../components/CurrencyConverter';
import { apiClient } from '../../hooks/useApi';
import type { RoomSlotAvailabilityResponse, RateOption, Booking } from '@dagmar/shared';

type Step = 'dates' | 'rates' | 'form' | 'done';

interface HouseRule {
  id: string;
  text: string;
  sortOrder: number;
  translations?: Record<string, string>;
}

interface RoomCatOption {
  roomCategoryId: string;
  name: string;
  translations?: Record<string, string>;
  rates: RateOption[];
}

interface RoomSlot {
  categories: RoomCatOption[];
}

function deduplicateRates(rates: RateOption[]): RateOption[] {
  const groups = new Map<string, RateOption>();
  for (const rate of rates) {
    const key = `${rate.cancellationDays ?? ''}|${rate.serviceFeePercent ?? 0}|${rate.isRefundable ?? true}`;
    const existing = groups.get(key);
    if (!existing || rate.pricePerNight < existing.pricePerNight) {
      groups.set(key, rate);
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.pricePerNight - b.pricePerNight);
}

export default function AvailabilityPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const ruleText = (rule: HouseRule) =>
    rule.translations?.[i18n.language] ??
    rule.translations?.['en'] ??
    rule.text;

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);

  const [step, setStep] = React.useState<Step>('dates');

  // Step 1 — dates
  const [checkIn, setCheckIn] = React.useState(tomorrow);
  const [checkOut, setCheckOut] = React.useState(nextWeek);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  // Step 2 — room slots
  const [roomData, setRoomData] = React.useState<RoomSlotAvailabilityResponse | null>(null);
  // Which slot indices are selected
  const [selectedSlots, setSelectedSlots] = React.useState<Set<number>>(new Set());
  // Chosen category per slot index
  const [slotCats, setSlotCats] = React.useState<Record<number, string>>({});
  // Chosen rate per category id
  const [catRates, setCatRates] = React.useState<Record<string, RateOption>>({});

  // Step 3 — booking form
  const [bookingMode, setBookingMode] = React.useState<'manual' | 'autonomous'>('manual');
  const [arrivalTime, setArrivalTime] = React.useState('16:00');
  const [departureTime, setDepartureTime] = React.useState('10:00');
  const [form, setForm] = React.useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    notes: '',
    paymentMethod: 'MOBILEPAY' as 'MOBILEPAY' | 'FLATPAY',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [confirmedRef, setConfirmedRef] = React.useState<string | null>(null);
  const [confirmedTotal, setConfirmedTotal] = React.useState(0);

  // House rules
  const [houseRules, setHouseRules] = React.useState<HouseRule[]>([]);
  const [houseRulesAccepted, setHouseRulesAccepted] = React.useState(false);
  const [houseRulesOpen, setHouseRulesOpen] = React.useState(false);

  // Discount codes
  const [discountOpen, setDiscountOpen] = React.useState(false);
  const [discountInput, setDiscountInput] = React.useState('');
  const [appliedDiscount, setAppliedDiscount] = React.useState<{ code: string; percent: number; name: string } | null>(null);
  const [discountError, setDiscountError] = React.useState('');
  const [validatingDiscount, setValidatingDiscount] = React.useState(false);

  const nights = Math.max(0, Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  ));

  React.useEffect(() => {
    apiClient.get<{ bookingMode: 'manual' | 'autonomous'; arrivalTime: string; departureTime: string }>('/settings')
      .then(r => {
        setBookingMode(r.data.bookingMode);
        if (r.data.arrivalTime) setArrivalTime(r.data.arrivalTime);
        if (r.data.departureTime) setDepartureTime(r.data.departureTime);
      })
      .catch(() => {});
    apiClient.get<HouseRule[]>('/house-rules')
      .then(r => setHouseRules(r.data))
      .catch(() => {});
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nights < 1) return;
    setSearching(true);
    setSearchError(null);
    setSelectedSlots(new Set());
    setSlotCats({});
    setCatRates({});

    try {
      const res = await apiClient.get<RoomSlotAvailabilityResponse>(
        `/availability/rooms?checkIn=${checkIn}&checkOut=${checkOut}`
      );
      setRoomData(res.data);
      setStep('rates');
    } catch (err: any) {
      setSearchError(err.response?.data?.error || t('common.error'));
    } finally {
      setSearching(false);
    }
  };

  const rooms: RoomSlot[] = roomData?.rooms ?? [];

  // Pick a category (and optionally select the slot if not yet selected)
  const pickCategory = (idx: number, catId: string) => {
    setSlotCats(sc => ({ ...sc, [idx]: catId }));
    // Auto-select cheapest rate for this category if not yet set
    const cat = rooms[idx]?.categories.find(c => c.roomCategoryId === catId);
    if (cat) {
      const rates = deduplicateRates(cat.rates);
      if (rates.length > 0) {
        setCatRates(cr => ({ ...cr, [catId]: cr[catId] ?? rates[0] }));
      }
    }
    // Select the slot if it isn't already
    setSelectedSlots(prev => {
      if (prev.has(idx) || prev.size >= rooms.length) return prev;
      return new Set([...prev, idx]);
    });
  };

  const toggleSlot = (idx: number) => {
    const room = rooms[idx];
    if (!room) return;
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        setSlotCats(sc => { const n = { ...sc }; delete n[idx]; return n; });
      } else {
        if (next.size >= rooms.length) return prev;
        next.add(idx);
        // Auto-select first category and its cheapest rate
        if (!slotCats[idx] && room.categories.length > 0) {
          const firstCat = room.categories[0];
          setSlotCats(sc => ({ ...sc, [idx]: firstCat.roomCategoryId }));
          const rates = deduplicateRates(firstCat.rates);
          if (rates.length > 0) {
            setCatRates(cr => ({ ...cr, [firstCat.roomCategoryId]: cr[firstCat.roomCategoryId] ?? rates[0] }));
          }
        }
      }
      return next;
    });
  };

  const setRate = (catId: string, rate: RateOption) => {
    setCatRates(cr => ({ ...cr, [catId]: rate }));
  };

  // Group selected slots by category for summary + payload
  const selectedByCategory = React.useMemo(() => {
    const grouped: Record<string, { name: string; translations?: Record<string, string>; count: number; rate: RateOption | null }> = {};
    for (const idx of selectedSlots) {
      const catId = slotCats[idx];
      if (!catId) continue;
      const catInfo = rooms[idx]?.categories.find(c => c.roomCategoryId === catId);
      if (!catInfo) continue;
      if (!grouped[catId]) grouped[catId] = { name: catInfo.name, translations: catInfo.translations, count: 0, rate: catRates[catId] ?? null };
      grouped[catId].count++;
    }
    return Object.entries(grouped).map(([catId, info]) => ({ catId, ...info }));
  }, [rooms, selectedSlots, slotCats, catRates]);

  const catDisplayName = (name: string, translations?: Record<string, string>) =>
    translations?.[i18n.language] ?? translations?.['en'] ?? name;

  const grandTotal = React.useMemo(() => {
    return selectedByCategory.reduce((sum, { count, rate }) => {
      if (!rate) return sum;
      return sum + (rate.totalPrice + rate.chargesTotal) * count;
    }, 0);
  }, [selectedByCategory]);

  const discountedTotal = appliedDiscount
    ? Math.round(grandTotal * (1 - appliedDiscount.percent / 100))
    : grandTotal;

  const anySelected = selectedSlots.size > 0;

  const buildRoomsPayload = () => {
    return selectedByCategory
      .filter(({ rate }) => rate !== null)
      .map(({ catId, count, rate }) => ({
        roomCategoryId: catId,
        count,
        pricePerNight: rate!.pricePerNight,
        chargesTotal: rate!.chargesTotal,
        rateLabel: rate!.label,
      }));
  };

  const handleContinueToForm = () => {
    if (!anySelected) return;
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (houseRules.length > 0 && !houseRulesAccepted) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const bookingRes = await apiClient.post<Booking>('/bookings', {
        checkIn,
        checkOut,
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: form.guestPhone || undefined,
        notes: form.notes || undefined,
        paymentMethod: form.paymentMethod,
        rooms: buildRoomsPayload(),
        discountCode: appliedDiscount?.code,
      });

      const booking = bookingRes.data;

      if (bookingMode === 'autonomous') {
        const endpoint = form.paymentMethod === 'MOBILEPAY'
          ? '/payments/mobilepay/initiate'
          : '/payments/flatpay/initiate';
        const payRes = await apiClient.post<{ redirectUrl: string }>(endpoint, { bookingId: booking.id });
        window.location.href = payRes.data.redirectUrl;
      } else {
        setConfirmedRef(booking.bookingRef);
        setConfirmedTotal(booking.totalPrice);
        setStep('done');
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || t('common.error'));
      setSubmitting(false);
    }
  };

  const applyDiscount = async () => {
    if (!discountInput.trim()) return;
    setValidatingDiscount(true);
    setDiscountError('');
    try {
      const res = await apiClient.post<{ valid: boolean; discountPercent: number; type: string; name: string }>(
        '/discount-codes/validate',
        { code: discountInput.trim() }
      );
      setAppliedDiscount({ code: discountInput.trim().toUpperCase(), percent: res.data.discountPercent, name: res.data.name });
    } catch (err: any) {
      setDiscountError(err.response?.data?.error || t('booking.discount_invalid'));
    } finally {
      setValidatingDiscount(false);
    }
  };

  const handleBack = () => {
    if (step === 'form') setStep('rates');
    else if (step === 'rates') {
      setStep('dates');
      setDiscountOpen(false);
      setDiscountInput('');
      setAppliedDiscount(null);
      setDiscountError('');
    }
  };

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (step === 'done' && confirmedRef) {
    return (
      <Layout>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '5rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--color-primary)', marginBottom: '0.75rem' }}>
            {t('confirm.title')}
          </h1>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>{t('confirm.subtitle')}</p>
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '0.25rem' }}>{t('confirm.ref')}</div>
            <div style={{ fontFamily: 'monospace', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              {confirmedRef}
            </div>
            <hr style={{ margin: '1rem 0' }} />
            <div style={{ fontSize: '0.875rem', color: '#555' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>{t('confirm.check_in')}:</strong>{' '}
                {new Date(checkIn).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>{t('booking.arrival_from')} {arrivalTime}</span>
              </p>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>{t('confirm.check_out')}:</strong>{' '}
                {new Date(checkOut).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>{t('booking.departure_before')} {departureTime}</span>
              </p>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>{t('confirm.total')}:</strong> {confirmedTotal.toLocaleString('da-DK')} DKK
              </p>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>
            {t('confirm.callback_notice')}
          </p>
          <button onClick={() => navigate('/')} className="btn-primary">
            {t('confirm.back_home')}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '3rem 1rem' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2.5rem', justifyContent: 'center' }}>
          {(['dates', 'rates', 'form'] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = {
              dates: t('booking.select_dates'),
              rates: t('booking.rate'),
              form: t('booking.your_details'),
              done: '',
            };
            const isActive = step === s;
            const isDone = ['dates', 'rates', 'form'].indexOf(step) > i;
            return (
              <React.Fragment key={s}>
                {i > 0 && (
                  <div style={{ flex: 1, height: '1px', backgroundColor: isDone ? 'var(--color-primary)' : '#e0e0e0', maxWidth: '80px' }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8125rem', fontWeight: 600,
                    backgroundColor: isActive || isDone ? 'var(--color-primary)' : '#e0e0e0',
                    color: isActive || isDone ? 'white' : '#999',
                  }}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: isActive ? 'var(--color-primary)' : '#999', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {labels[s]}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Step 1: Date selection ─────────────────────────────────────── */}
        {step === 'dates' && (
          <form onSubmit={handleSearch}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--color-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>
              {t('booking.book_any_room')}
            </h1>
            <p style={{ color: '#666', textAlign: 'center', marginBottom: '2rem' }}>
              {t('booking.select_dates_subtitle')}
            </p>

            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>{t('booking.check_in')}</label>
                  <input type="date" className="input-field" value={checkIn} min={tomorrow}
                    onChange={e => setCheckIn(e.target.value)} required />
                  <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                    {t('booking.arrival_from')} {arrivalTime}
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>{t('booking.check_out')}</label>
                  <input type="date" className="input-field" value={checkOut} min={checkIn || tomorrow}
                    onChange={e => setCheckOut(e.target.value)} required />
                  <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                    {t('booking.departure_before')} {departureTime}
                  </p>
                </div>
              </div>

              {nights > 0 && (
                <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.25rem', textAlign: 'center' }}>
                  {t(nights === 1 ? 'booking.nights' : 'booking.nights_plural', { count: nights })}
                </p>
              )}

              {searchError && (
                <p style={{ color: '#c0392b', fontSize: '0.875rem', padding: '0.75rem', backgroundColor: '#fdf0ef', borderRadius: '4px', marginBottom: '1rem' }}>
                  {searchError}
                </p>
              )}

              <button type="submit" className="btn-primary" disabled={searching || nights < 1}
                style={{ width: '100%', padding: '0.875rem', fontSize: '1rem' }}>
                {searching ? t('common.loading') : t('booking.check_availability')}
              </button>

              {/* House rules inside the card, below the button */}
              {houseRules.length > 0 && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', color: 'var(--color-primary)', marginBottom: '0.375rem' }}>
                    {t('booking.house_rules')}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '0.75rem' }}>
                    {t('booking.house_rules_subtitle')}
                  </p>
                  <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {houseRules.map(rule => (
                      <li key={rule.id} style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
                        {ruleText(rule)}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </form>
        )}

        {/* ── Step 2: Room slot picker ───────────────────────────────────── */}
        {step === 'rates' && roomData && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                {t('booking.available_rates')}
              </h2>
              <p style={{ color: '#666', fontSize: '0.9375rem' }}>
                {new Date(checkIn).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}
                {' → '}
                {new Date(checkOut).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                <strong>{t(nights === 1 ? 'booking.nights' : 'booking.nights_plural', { count: nights })}</strong>
              </p>
            </div>

            {rooms.length === 0 ? (
              <>
                <div style={{ padding: '2rem', backgroundColor: '#fdf0ef', borderRadius: '8px', color: '#c0392b', textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>😔</div>
                  {t('booking.no_rooms_available')}
                </div>
                <button onClick={handleBack} className="btn-secondary" style={{ width: '100%' }}>
                  ← {t('booking.change_dates')}
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
                  {rooms.map((room, idx) => {
                    const activeCatId = slotCats[idx] ?? room.categories[0]?.roomCategoryId ?? '';
                    return (
                      <RoomSlotCard
                        key={idx}
                        room={room}
                        nights={nights}
                        isSelected={selectedSlots.has(idx)}
                        canSelect={selectedSlots.size < rooms.length || selectedSlots.has(idx)}
                        activeCatId={activeCatId}
                        selectedRate={catRates[activeCatId] ?? null}
                        onToggle={() => toggleSlot(idx)}
                        onPickCategory={catId => pickCategory(idx, catId)}
                        onSelectRate={rate => setRate(activeCatId, rate)}
                      />
                    );
                  })}
                </div>

                {grandTotal > 0 && (
                  <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{t('booking.total')}</span>
                      <div style={{ textAlign: 'right' }}>
                        {appliedDiscount && (
                          <div style={{ fontSize: '0.8125rem', color: '#888', textDecoration: 'line-through' }}>
                            {grandTotal.toLocaleString('da-DK')} DKK
                          </div>
                        )}
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {discountedTotal.toLocaleString('da-DK')} DKK
                        </div>
                        <CurrencyConverter amountDKK={discountedTotal} />
                      </div>
                    </div>
                    {/* Discount code */}
                    <div style={{ borderTop: '1px solid #e0e0e0', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                      {appliedDiscount ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.875rem', color: '#10b981' }}>
                            {t('booking.discount_applied', { name: appliedDiscount.name, percent: appliedDiscount.percent })}
                          </span>
                          <button onClick={() => { setAppliedDiscount(null); setDiscountInput(''); setDiscountOpen(false); }}
                            style={{ fontSize: '0.8rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                            {t('common.remove')}
                          </button>
                        </div>
                      ) : discountOpen ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            className="input-field"
                            value={discountInput}
                            onChange={e => { setDiscountInput(e.target.value); setDiscountError(''); }}
                            placeholder={t('booking.discount_code_placeholder')}
                            style={{ flex: 1, fontSize: '0.875rem', padding: '0.375rem 0.625rem' }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={applyDiscount}
                            disabled={validatingDiscount || !discountInput.trim()}
                            className="btn-secondary"
                            style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem', whiteSpace: 'nowrap' }}
                          >
                            {t('booking.apply_discount')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDiscountOpen(true)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#888', padding: 0, textDecoration: 'underline' }}
                        >
                          {t('booking.have_discount_code')}
                        </button>
                      )}
                      {discountError && <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.375rem' }}>{discountError}</div>}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleBack} className="btn-secondary" style={{ flex: '0 0 auto' }}>
                    ← {t('booking.change_dates')}
                  </button>
                  <button onClick={handleContinueToForm} className="btn-primary" disabled={!anySelected}
                    style={{ flex: 1, padding: '0.875rem', fontSize: '1rem' }}>
                    {t('booking.continue')} →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Booking form ───────────────────────────────────────── */}
        {step === 'form' && anySelected && (
          <div>
            {/* Summary banner */}
            <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#555', marginBottom: '0.5rem' }}>
                {new Date(checkIn).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(checkOut).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                <span style={{ color: '#888', margin: '0 0.5rem' }}>·</span>
                {t(nights === 1 ? 'booking.nights' : 'booking.nights_plural', { count: nights })}
              </div>
              {selectedByCategory.map(({ catId, name, translations, count, rate }) => {
                if (!rate) return null;
                return (
                  <React.Fragment key={catId}>
                    <div style={{ fontSize: '0.8125rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{count}× {catDisplayName(name, translations)} — {rate.label}</span>
                      <span>{(rate.totalPrice * count).toLocaleString('da-DK')} DKK</span>
                    </div>
                    {rate.charges.map(charge => (
                      <div key={charge.name} style={{ fontSize: '0.8125rem', color: '#888', display: 'flex', justifyContent: 'space-between', paddingLeft: '0.75rem' }}>
                        <span>{count > 1 ? `${count}× ` : ''}{charge.name}</span>
                        <span>{(charge.amountDKK * count).toLocaleString('da-DK')} DKK</span>
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}
              <div style={{ borderTop: '1px solid #e0e0e0', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9375rem' }}>{t('booking.total')}</strong>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {grandTotal.toLocaleString('da-DK')} DKK
                  </div>
                  <CurrencyConverter amountDKK={grandTotal} />
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
              <div>
                <label style={labelStyle}>{t('booking.guest_name')} *</label>
                <input type="text" className="input-field" value={form.guestName} required
                  onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('booking.guest_email')} *</label>
                <input type="email" className="input-field" value={form.guestEmail} required
                  onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('booking.guest_phone')}</label>
                <input type="tel" className="input-field" value={form.guestPhone}
                  onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))} />
              </div>
              {/* House rules acceptance */}
              {houseRules.length > 0 && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={houseRulesAccepted}
                      onChange={e => setHouseRulesAccepted(e.target.checked)}
                      style={{ marginTop: '0.2rem', flexShrink: 0, width: '16px', height: '16px', cursor: 'pointer' }}
                      required
                    />
                    <span style={{ fontSize: '0.9375rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                      {t('booking.accept_house_rules')}
                      <button
                        type="button"
                        onClick={() => setHouseRulesOpen(v => !v)}
                        title={t('booking.house_rules_info')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: houseRulesOpen ? 'var(--color-primary)' : '#aaa', padding: '0 0 0 0.375rem', verticalAlign: 'middle', lineHeight: 1, display: 'inline-flex', alignItems: 'center', transition: 'color 0.15s' }}
                        aria-label={t('booking.house_rules_info')}
                      >
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                          <line x1="8" y1="7" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <circle cx="8" cy="5" r="0.75" fill="currentColor"/>
                        </svg>
                      </button>
                    </span>
                  </label>
                  {houseRulesOpen && (
                    <ol style={{ margin: '0.625rem 0 0 1.625rem', paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {houseRules.map(rule => (
                        <li key={rule.id} style={{ fontSize: '0.875rem', color: '#555', lineHeight: 1.55 }}>
                          {ruleText(rule)}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              <div>
                <label style={labelStyle}>{t('booking.notes')}</label>
                <textarea className="input-field" rows={3} value={form.notes} style={{ resize: 'vertical' }}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {bookingMode === 'autonomous' && (
                <div>
                  <label style={labelStyle}>{t('booking.payment_method')}</label>
                  <div style={{ display: 'flex', gap: '0.875rem' }}>
                    {(['MOBILEPAY', 'FLATPAY'] as const).map(method => (
                      <label key={method} style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                        padding: '0.75rem 1rem', flex: 1,
                        border: `2px solid ${form.paymentMethod === method ? 'var(--color-primary)' : '#e0e0e0'}`,
                        borderRadius: '6px',
                      }}>
                        <input type="radio" name="payment" value={method} checked={form.paymentMethod === method}
                          onChange={() => setForm(f => ({ ...f, paymentMethod: method }))} />
                        <span style={{ fontWeight: 500 }}>
                          {method === 'MOBILEPAY' ? '📱 ' + t('booking.mobilepay') : '💳 ' + t('booking.flatpay')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {submitError && (
                <p style={{ color: '#c0392b', fontSize: '0.875rem', padding: '0.75rem', backgroundColor: '#fdf0ef', borderRadius: '4px' }}>
                  {submitError}
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={handleBack} className="btn-secondary" style={{ flex: '0 0 auto' }}>←</button>
                <button type="submit" className="btn-primary" disabled={submitting || (houseRules.length > 0 && !houseRulesAccepted)}
                  style={{ flex: 1, padding: '0.875rem', fontSize: '1rem' }}>
                  {submitting
                    ? t('common.loading')
                    : bookingMode === 'autonomous'
                      ? t('booking.proceed_payment')
                      : t('booking.send_booking')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── RoomSlotCard ──────────────────────────────────────────────────────────────

interface RoomSlotCardProps {
  room: RoomSlot;
  nights: number;
  isSelected: boolean;
  canSelect: boolean;
  activeCatId: string;
  selectedRate: RateOption | null;
  onToggle: () => void;
  onPickCategory: (catId: string) => void;
  onSelectRate: (rate: RateOption) => void;
}

function RoomSlotCard({
  room, nights, isSelected, canSelect,
  activeCatId, selectedRate, onToggle, onPickCategory, onSelectRate,
}: RoomSlotCardProps) {
  const { t, i18n } = useTranslation();
  const [showBreakdown, setShowBreakdown] = React.useState(false);
  const pickName = (name: string, translations?: Record<string, string>) =>
    translations?.[i18n.language] ?? translations?.['en'] ?? name;

  const activeCat = room.categories.find(c => c.roomCategoryId === activeCatId) ?? room.categories[0];
  const displayRates = activeCat ? deduplicateRates(activeCat.rates) : [];
  const cheapest = displayRates.length ? displayRates[0].pricePerNight : 0;
  const dayPrices = selectedRate?.dayPrices ?? [];
  const pricesVary = dayPrices.length > 1 && dayPrices.some(d => d.price !== dayPrices[0].price);

  return (
    <div className="card" style={{
      padding: '1.25rem 1.5rem',
      border: isSelected ? '2px solid var(--color-primary)' : '1px solid #e0e0e0',
      opacity: !canSelect && !isSelected ? 0.5 : 1,
    }}>
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: canSelect ? 'pointer' : 'not-allowed' }}
        onClick={() => canSelect && onToggle()}
      >
        <div style={{
          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${isSelected ? 'var(--color-primary)' : '#ccc'}`,
          background: isSelected ? 'var(--color-primary)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <span style={{ color: '#fff', fontSize: '0.75rem' }}>✓</span>}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>
            {t('booking.room')}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {isSelected && selectedRate ? (
            <>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
                {(pricesVary
                  ? Math.min(...dayPrices.map(d => d.price))
                  : selectedRate.pricePerNight
                ).toLocaleString('da-DK')} DKK/{t('booking.per_night').replace('DKK / ', '')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>{selectedRate.label}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {t('booking.from')}
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
                {cheapest.toLocaleString('da-DK')} DKK/{t('booking.per_night').replace('DKK / ', '')}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category picker — shown for multi-category rooms */}
      {room.categories.length > 1 ? (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' }}>
          {room.categories.map(cat => {
            const catDisplayRates = deduplicateRates(cat.rates);
            const catCheapest = catDisplayRates.length ? catDisplayRates[0].pricePerNight : 0;
            const isActive = cat.roomCategoryId === activeCatId;
            return (
              <button
                key={cat.roomCategoryId}
                type="button"
                onClick={e => { e.stopPropagation(); onPickCategory(cat.roomCategoryId); }}
                style={{
                  width: '100%', padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: isActive ? 600 : 400,
                  border: `2px solid ${isActive ? 'var(--color-primary)' : '#ddd'}`,
                  background: isActive ? 'rgba(var(--color-primary-rgb,96,73,60),0.08)' : 'var(--color-surface)',
                  color: isActive ? 'var(--color-primary)' : '#555',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  textAlign: 'left',
                }}
              >
                <span>{pickName(cat.name, cat.translations)}</span>
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{t('booking.from')} {catCheapest.toLocaleString('da-DK')} kr</span>
              </button>
            );
          })}
        </div>
      ) : (
        room.categories.length === 1 && (
          <div style={{ marginTop: '0.4rem' }}>
            <span style={{
              display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '999px',
              fontSize: '0.6875rem', fontWeight: 600, background: 'var(--color-primary)',
              color: '#fff', opacity: 0.85,
            }}>
              {pickName(room.categories[0].name, room.categories[0].translations)}
            </span>
          </div>
        )
      )}

      {/* Rate picker — shown when slot is selected */}
      {isSelected && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f0f0f0' }}>
          {displayRates.length > 1 && (
            <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('booking.rate')}:
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {displayRates.map((rate, i) => {
              const isChosen = selectedRate?.categoryId === rate.categoryId;
              const saving = i > 0 && displayRates[0]
                ? Math.round((1 - rate.pricePerNight / displayRates[0].pricePerNight) * 100)
                : 0;
              return (
                <div
                  key={i}
                  onClick={e => { e.stopPropagation(); onSelectRate(rate); }}
                  style={{
                    padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer',
                    border: `2px solid ${isChosen ? 'var(--color-primary)' : '#e8e8e8'}`,
                    background: isChosen ? 'rgba(var(--color-primary-rgb,96,73,60),0.04)' : 'var(--color-surface)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{rate.label}</span>
                      {saving > 0 && (
                        <span style={{
                          display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: '999px',
                          fontSize: '0.625rem', fontWeight: 700, background: '#10b981', color: '#fff',
                        }}>
                          {t('booking.save_percent', { percent: saving })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#888' }}>
                      {rate.cancellationDays != null && rate.cancellationDays > 0
                        ? t('booking.free_cancellation_days', { days: rate.cancellationDays })
                        : t('booking.non_refundable_desc')}
                    </div>
                    {rate.charges.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.25rem' }}>
                        {rate.charges.map(c => `+ ${c.name} (${c.amountDKK.toLocaleString('da-DK')} DKK)`).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: isChosen ? 'var(--color-primary)' : '#333' }}>
                      {rate.pricePerNight.toLocaleString('da-DK')} DKK/{t('booking.per_night').replace('DKK / ', '')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                      {(rate.totalPrice + rate.chargesTotal).toLocaleString('da-DK')} DKK {t('booking.nights_plural', { count: nights }).replace('{{count}} ', '')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-night price breakdown toggle */}
          {dayPrices.length > 1 && (
            <div style={{ marginTop: '0.625rem' }}>
              <button type="button" onClick={() => setShowBreakdown(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', fontSize: '0.8125rem', padding: 0 }}>
                {showBreakdown ? '▲' : '▼'} {t('booking.price_breakdown')}
              </button>
              {showBreakdown && (
                <div style={{ margin: '0.5rem 0', padding: '0.625rem 0.75rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '6px', fontSize: '0.8125rem' }}>
                  {dayPrices.map((d, i) => {
                    const date = new Date(d.date);
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.1875rem 0', borderBottom: i < dayPrices.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <span style={{ color: '#555' }}>
                          {date.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span style={{ fontWeight: d.price !== dayPrices[0].price ? 600 : 400, color: d.price !== dayPrices[0].price ? 'var(--color-primary)' : '#666' }}>
                          {d.price.toLocaleString('da-DK')} DKK
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500,
};
