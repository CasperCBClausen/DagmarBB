import React from 'react';
import { Layout } from '../../components/Layout';

// ─── Shared mock data ────────────────────────────────────────────────────────

const MOCK_DATES = { checkIn: '2026-05-01', checkOut: '2026-05-04', nights: 3 };

// Category-level availability — what the guest sees. Physical room assignment is the host's job.
// "available" = how many bookings can still be accepted in this category for the selected dates.
// A room shared between categories may be counted in both, but the host resolves conflicts at assignment time.
const MOCK_CATEGORY_AVAILABILITY = [
  { catId: 'standard', name: 'Standard', available: 2, description: '1 seng · eget bad · op til 2 gæster' },
  { catId: 'deluxe',   name: 'Deluxe',   available: 2, description: 'Suite · havudsigt · op til 3 gæster' },
  { catId: 'premium',  name: 'Premium',  available: 1, description: 'Penthouse · terrasse · op til 4 gæster' },
];

// Physical rooms — used by Design 1 and designs 6-9.
// Rooms r1 and r2 are already booked for the selected dates (available: false).
// This creates an interesting scenario:
//   Standard: only r3 (single-cat) and r4 (multi-cat) are left
//   Deluxe:   r4 (multi-cat) and r5 (multi-cat) — both flexible
//   Premium:  only r5 (multi-cat) — if Deluxe takes r5, Premium disappears
// Guests never see the room names — only generic labels + category badges.
const MOCK_PHYSICAL_ROOMS = [
  { id: 'r1', name: 'r1', categories: ['Standard'],          pricesByCategory: { Standard: 850 },              available: false }, // booked
  { id: 'r2', name: 'r2', categories: ['Standard'],          pricesByCategory: { Standard: 850 },              available: false }, // booked
  { id: 'r3', name: 'r3', categories: ['Standard'],          pricesByCategory: { Standard: 850 },              available: true  },
  { id: 'r4', name: 'r4', categories: ['Standard', 'Deluxe'], pricesByCategory: { Standard: 1050, Deluxe: 1250 }, available: true  },
  { id: 'r5', name: 'r5', categories: ['Deluxe', 'Premium'], pricesByCategory: { Deluxe: 1250, Premium: 1550 }, available: true  },
];

const MOCK_CATEGORIES = [
  { id: 'standard', name: 'Standard', rooms: ['r1', 'r2', 'r3', 'r4'], available: 3 },
  { id: 'deluxe', name: 'Deluxe', rooms: ['r4', 'r5'], available: 2 },
  { id: 'premium', name: 'Premium', rooms: ['r5'], available: 1 },
];

const MOCK_RATES: Record<string, { label: string; pricePerNight: number; cancellationDays: number }[]> = {
  standard: [
    { label: 'Fleksibel', pricePerNight: 850, cancellationDays: 7 },
    { label: 'Ikke-refunderbar', pricePerNight: 720, cancellationDays: 0 },
  ],
  deluxe: [
    { label: 'Fleksibel', pricePerNight: 1250, cancellationDays: 7 },
    { label: 'Ikke-refunderbar', pricePerNight: 1050, cancellationDays: 0 },
  ],
  premium: [
    { label: 'Fleksibel', pricePerNight: 1550, cancellationDays: 7 },
  ],
};

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid #e0e0e0',
  borderRadius: '10px',
  padding: '1.25rem',
};

const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '0.125rem 0.5rem',
  borderRadius: '999px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
  background: color,
  color: '#fff',
});

const CAT_COLORS: Record<string, string> = {
  Standard: '#6b7280',
  Deluxe: '#7c3aed',
  Premium: '#b45309',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '0.625rem 1.25rem',
  fontSize: '0.9375rem',
  cursor: 'pointer',
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-primary)',
  border: '1.5px solid var(--color-primary)',
  borderRadius: '6px',
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

function DateBar() {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ ...card, padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>Ankomst</span>
          <strong>1. maj 2026</strong>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>fra 16:00</span>
        </div>
        <div style={{ ...card, padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>Afrejse</span>
          <strong>4. maj 2026</strong>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>inden 10:00</span>
        </div>
        <div style={{ ...card, padding: '0.5rem 1rem', color: '#555', fontSize: '0.875rem' }}>
          3 nætter
        </div>
      </div>
      <button style={btnSecondary}>Skift datoer</button>
    </div>
  );
}

// ─── Category picker for multi-category rooms ─────────────────────────────────

interface CatPickerProps {
  room: typeof MOCK_PHYSICAL_ROOMS[0];
  chosen: string;
  onChange: (cat: string) => void;
}

function InlineCatPicker({ room, chosen, onChange }: CatPickerProps) {
  if (room.categories.length <= 1) return null;
  return (
    <div style={{ marginTop: '0.625rem', padding: '0.625rem 0.75rem', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '6px' }}>
      <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600, marginBottom: '0.375rem' }}>
        Delt værelse — vælg hvilken kategori du vil booke som:
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {room.categories.map(cat => {
          const price = room.pricesByCategory[cat as keyof typeof room.pricesByCategory] ?? 0;
          const isChosen = chosen === cat;
          return (
            <button key={cat} onClick={() => onChange(cat)} style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '6px',
              border: `2px solid ${isChosen ? CAT_COLORS[cat] ?? '#888' : '#d8b4fe'}`,
              background: isChosen ? (CAT_COLORS[cat] ?? '#888') : 'transparent',
              color: isChosen ? '#fff' : '#7c3aed',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}>
              {cat} · {price.toLocaleString('da-DK')} kr/nat
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Design 1: Physical rooms, generic names, no occupied cards ──────────────
//
// Rules:
// 1. Only show rooms where available=true (occupied rooms simply don't appear).
// 2. Generic names — guest sees "Mulighed 1 / 2 / 3", not physical room identities.
// 3. Multi-category rooms show an inline picker: guest chooses which category
//    (and therefore which price) to book the room as.
// 4. Availability in current session: selecting a room removes it from the pool.
//    If that was the ONLY room for a given category, that category disappears.
//    BUT if a single-category room for that category still exists, the multi-cat
//    room can be claimed by the other category and the single-cat room covers the first.
// 5. Rate picker (flexible / non-refundable) expands inside the selected card.

type D1Selection = { cat: string; rateIdx: number };


function Design1() {
  const [selections, setSelections] = React.useState<Record<string, D1Selection>>({}); // roomId → {cat, rateIdx}

  const availableRooms = MOCK_PHYSICAL_ROOMS.filter(r => r.available);
  const visibleRooms = availableRooms;

  const toggle = (room: typeof MOCK_PHYSICAL_ROOMS[0]) => {
    if (selections[room.id]) {
      const s = { ...selections }; delete s[room.id]; setSelections(s);
    } else {
      setSelections(s => ({ ...s, [room.id]: { cat: room.categories[0], rateIdx: 0 } }));
    }
  };

  const total = Object.entries(selections).reduce((sum, [, { cat, rateIdx }]) => {
    const price = MOCK_RATES[cat.toLowerCase()]?.[rateIdx]?.pricePerNight ?? 0;
    return sum + price * MOCK_DATES.nights;
  }, 0);

  // Generic label: sequential number based on position in the visible list
  const genericLabel = (idx: number) => `Mulighed ${idx + 1}`;

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Optagede rum vises ikke. Rum med flere kategorier lader gæsten vælge hvilken kategori (og pris) de booker som. Generiske navne skjuler det fysiske rums identitet — værtsparret tildeler rum efter booking.
      </p>

      {/* Scenario note */}
      <div style={{ padding: '0.625rem 0.875rem', background: '#fef9c3', borderRadius: '6px', fontSize: '0.8125rem', color: '#713f12', marginBottom: '1rem' }}>
        <strong>Mock-scenarie:</strong> 2 Standard-rum er allerede optaget. Tilbage: 1 Standard-rum, 1 Standard/Deluxe-suite og 1 Deluxe/Premium-suite.
        Vælg suiten som Standard → Deluxe mister én mulighed, men Premium-suiten er stadig ledig.
      </div>

      <DateBar />

      {visibleRooms.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#888', padding: '2rem' }}>
          Ingen ledige værelser for disse datoer.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {visibleRooms.map((room, idx) => {
          const isSelected = !!selections[room.id];
          const sel = selections[room.id];
          const chosenCat = sel?.cat ?? room.categories[0];
          const rateIdx = sel?.rateIdx ?? 0;
          const rates = MOCK_RATES[chosenCat.toLowerCase()] ?? [];
          const cheapest = rates.length ? Math.min(...rates.map(r => r.pricePerNight)) : 0;
          const chosenRate = rates[rateIdx];

          return (
            <div key={room.id} style={{
              ...card,
              border: isSelected ? '2px solid var(--color-primary)' : '1px solid #e0e0e0',
            }}>
              {/* ── Header row ── */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
                onClick={() => toggle(room)}
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
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                    {genericLabel(idx)}
                    {room.categories.length > 1 && (
                      <span style={{ ...badge('#7c3aed'), marginLeft: '0.5rem', fontSize: '0.6rem' }}>Fleksibel</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {room.categories.map(c => (
                      <span key={c} style={badge(CAT_COLORS[c] ?? '#888')}>{c}</span>
                    ))}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {isSelected && chosenRate ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
                        {chosenRate.pricePerNight.toLocaleString('da-DK')} kr/nat
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>{chosenRate.label}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.03em' }}>fra</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
                        {cheapest.toLocaleString('da-DK')} kr/nat
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Expanded: category picker + rate picker ── */}
              {isSelected && (
                <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid #f0f0f0' }}>

                  {/* Category picker — only for multi-category rooms */}
                  {room.categories.length > 1 && (
                    <div style={{ marginBottom: '0.75rem', padding: '0.625rem 0.75rem', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600, marginBottom: '0.375rem' }}>
                        Dette værelse er tilgængeligt i flere kategorier — vælg hvilken pris du vil booke til:
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {room.categories.map(cat => {
                          const catRates = MOCK_RATES[cat.toLowerCase()] ?? [];
                          const catCheapest = catRates.length ? Math.min(...catRates.map(r => r.pricePerNight)) : 0;
                          const isChosen = chosenCat === cat;
                          return (
                            <button key={cat} onClick={() => setSelections(s => ({ ...s, [room.id]: { cat, rateIdx: 0 } }))} style={{
                              padding: '0.375rem 0.875rem',
                              borderRadius: '6px',
                              border: `2px solid ${isChosen ? CAT_COLORS[cat] ?? '#888' : '#d8b4fe'}`,
                              background: isChosen ? (CAT_COLORS[cat] ?? '#888') : 'transparent',
                              color: isChosen ? '#fff' : '#7c3aed',
                              cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                            }}>
                              <span style={{ display: 'block' }}>{cat}</span>
                              <span style={{ display: 'block', fontWeight: 400, fontSize: '0.7rem', opacity: 0.9 }}>
                                fra {catCheapest.toLocaleString('da-DK')} kr/nat
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rate picker */}
                  <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Vælg prisplan:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {rates.map((rate, i) => {
                      const isChosen = rateIdx === i;
                      const saving = i > 0 && rates[0] ? Math.round((1 - rate.pricePerNight / rates[0].pricePerNight) * 100) : 0;
                      return (
                        <div
                          key={i}
                          onClick={e => { e.stopPropagation(); setSelections(s => ({ ...s, [room.id]: { cat: chosenCat, rateIdx: i } })); }}
                          style={{
                            padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer',
                            border: `2px solid ${isChosen ? 'var(--color-primary)' : '#e8e8e8'}`,
                            background: isChosen ? 'rgba(96,73,60,0.04)' : 'var(--color-surface)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{rate.label}</span>
                              {saving > 0 && <span style={{ ...badge('#10b981'), fontSize: '0.625rem' }}>Spar {saving}%</span>}
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: '#888' }}>
                              {rate.cancellationDays > 0
                                ? `Gratis afbestilling op til ${rate.cancellationDays} dage før ankomst`
                                : 'Ikke-refunderbar — betaling ved booking, laveste pris'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: isChosen ? 'var(--color-primary)' : '#333' }}>
                              {rate.pricePerNight.toLocaleString('da-DK')} kr/nat
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                              {(rate.pricePerNight * MOCK_DATES.nights).toLocaleString('da-DK')} kr i alt
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(selections).length > 0 && (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--color-primary)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{Object.keys(selections).length} værelse{Object.keys(selections).length > 1 ? 'r' : ''} valgt</div>
            <div style={{ fontSize: '0.875rem', color: '#888' }}>Total: {total.toLocaleString('da-DK')} kr</div>
          </div>
          <button style={btnPrimary}>Fortsæt →</button>
        </div>
      )}
    </div>
  );
}

// ─── Design 2: "How many rooms?" then type ────────────────────────────────────

function Design2() {
  const [count, setCount] = React.useState(1);
  const [step, setStep] = React.useState<'count' | 'type' | 'rate'>('count');
  const [chosenCat, setChosenCat] = React.useState('');
  const [chosenRate, setChosenRate] = React.useState(0);

  const totalPhysical = MOCK_PHYSICAL_ROOMS.filter(r => r.available).length;

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Gæsten vælger antal, derefter kategori. Delte rum er transparente — kategorien bestemmer prisen, ikke det fysiske rum.
      </p>
      <DateBar />

      {step === 'count' && (
        <div style={{ ...card, maxWidth: '420px' }}>
          <div style={{ fontWeight: 600, fontSize: '1.0625rem', marginBottom: '1.25rem' }}>
            Hvor mange værelser ønsker du?
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <button onClick={() => setCount(Math.max(1, count - 1))}
              style={{ ...btnSecondary, width: '40px', height: '40px', padding: 0, borderRadius: '50%', fontSize: '1.5rem', lineHeight: 1 }}>−</button>
            <span style={{ fontSize: '2rem', fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>{count}</span>
            <button onClick={() => setCount(Math.min(totalPhysical, count + 1))}
              style={{ ...btnSecondary, width: '40px', height: '40px', padding: 0, borderRadius: '50%', fontSize: '1.5rem', lineHeight: 1 }}>+</button>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '1.25rem' }}>
            {totalPhysical} ledige værelser i alt for disse datoer
          </div>
          <button style={btnPrimary} onClick={() => setStep('type')}>Vælg værelses-type →</button>
        </div>
      )}

      {step === 'type' && (
        <div>
          <div style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>
            Kategorier der kan huse {count} værelse{count > 1 ? 'r' : ''}:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1rem' }}>
            {MOCK_CATEGORIES.map(cat => {
              const fits = cat.available >= count;
              const rates = MOCK_RATES[cat.id] ?? [];
              const sharedRooms = MOCK_PHYSICAL_ROOMS.filter(r => r.categories.includes(cat.name) && r.categories.length > 1);
              return (
                <div key={cat.id} style={{
                  ...card,
                  opacity: fits ? 1 : 0.4,
                  border: chosenCat === cat.id ? '2px solid var(--color-primary)' : '1px solid #e0e0e0',
                  cursor: fits ? 'pointer' : 'not-allowed',
                }} onClick={() => fits && setChosenCat(cat.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                        <span style={badge(CAT_COLORS[cat.name] ?? '#888')}>{cat.name}</span>
                        {!fits && <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: '#ef4444' }}>Kun {cat.available} ledige</span>}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#888' }}>
                        Fra {Math.min(...rates.map(r => r.pricePerNight)).toLocaleString('da-DK')} kr/nat
                      </div>
                      {sharedRooms.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: '0.25rem' }}>
                          Inkl. {sharedRooms.length} delt rum — prisen afspejler {cat.name}-niveau
                        </div>
                      )}
                    </div>
                    {chosenCat === cat.id && <span style={{ color: 'var(--color-primary)', fontSize: '1.25rem' }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={btnSecondary} onClick={() => setStep('count')}>← Tilbage</button>
            <button style={{ ...btnPrimary, opacity: chosenCat ? 1 : 0.4 }}
              disabled={!chosenCat} onClick={() => setStep('rate')}>Vælg pris →</button>
          </div>
        </div>
      )}

      {step === 'rate' && (
        <div>
          <div style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>
            Vælg priskategori for {count} × {MOCK_CATEGORIES.find(c => c.id === chosenCat)?.name}:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1rem' }}>
            {(MOCK_RATES[chosenCat] ?? []).map((rate, i) => (
              <div key={i} style={{
                ...card,
                border: chosenRate === i ? '2px solid var(--color-primary)' : '1px solid #e0e0e0',
                cursor: 'pointer',
              }} onClick={() => setChosenRate(i)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{rate.label}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#888' }}>
                      {rate.cancellationDays > 0 ? `Gratis afbestilling op til ${rate.cancellationDays} dage før` : 'Ikke-refunderbar'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{rate.pricePerNight.toLocaleString('da-DK')} kr/nat</div>
                    <div style={{ fontSize: '0.8125rem', color: '#888' }}>{(rate.pricePerNight * MOCK_DATES.nights * count).toLocaleString('da-DK')} kr total</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={btnSecondary} onClick={() => setStep('type')}>← Tilbage</button>
            <button style={btnPrimary}>Book {count} værelse{count > 1 ? 'r' : ''} →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Design 3: Smart packages / combinations ──────────────────────────────────

const PACKAGES = [
  { id: 'p1', label: '1 Standard værelse', rooms: 1, categories: ['Standard'], pricePerNight: 850, available: true },
  { id: 'p2', label: '2 Standard værelser', rooms: 2, categories: ['Standard'], pricePerNight: 850, available: true },
  { id: 'p3', label: '3 Standard værelser', rooms: 3, categories: ['Standard'], pricePerNight: 850, available: false },
  { id: 'p4', label: '1 Deluxe værelse', rooms: 1, categories: ['Deluxe'], pricePerNight: 1250, available: true },
  { id: 'p5', label: '1 Standard + 1 Deluxe', rooms: 2, categories: ['Standard', 'Deluxe'], pricePerNight: 1050, available: true },
  { id: 'p6', label: '1 Premium Suite', rooms: 1, categories: ['Premium'], pricePerNight: 1550, available: true },
];

function Design3() {
  const [selected, setSelected] = React.useState('');

  const pkg = PACKAGES.find(p => p.id === selected);
  const total = pkg ? pkg.pricePerNight * MOCK_DATES.nights * pkg.rooms : 0;

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Forhåndsdefinerede pakker viser reelt tilgængelige kombinationer. Delte rum er allerede tildelt en kategori i pakken — ingen forvirring.
      </p>
      <DateBar />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {PACKAGES.map(pkg => (
          <div key={pkg.id} style={{
            ...card,
            opacity: pkg.available ? 1 : 0.4,
            border: selected === pkg.id ? '2px solid var(--color-primary)' : '1px solid #e0e0e0',
            cursor: pkg.available ? 'pointer' : 'not-allowed',
            position: 'relative',
          }} onClick={() => pkg.available && setSelected(pkg.id)}>
            {!pkg.available && (
              <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', ...badge('#ef4444') }}>Udsolgt</div>
            )}
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {pkg.categories.map(c => <span key={c} style={badge(CAT_COLORS[c] ?? '#888')}>{c}</span>)}
            </div>
            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{pkg.label}</div>
            <div style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '0.75rem' }}>
              {pkg.rooms} værelse{pkg.rooms > 1 ? 'r' : ''} · {MOCK_DATES.nights} nætter
            </div>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.0625rem' }}>
              {pkg.available ? `${(pkg.pricePerNight * MOCK_DATES.nights * pkg.rooms).toLocaleString('da-DK')} kr` : '—'}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--color-primary)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{PACKAGES.find(p => p.id === selected)?.label}</div>
            <div style={{ fontSize: '0.875rem', color: '#888' }}>Total: {total.toLocaleString('da-DK')} kr</div>
          </div>
          <button style={btnPrimary}>Fortsæt →</button>
        </div>
      )}
    </div>
  );
}

// ─── Design 4: Calendar + room grid (availability matrix) ────────────────────

const DAYS = ['To', 'Fr', 'Lø', 'Sø', 'Ma'];
const DATES_LABEL = ['1 maj', '2 maj', '3 maj', '4 maj', '5 maj'];

function Design4() {
  const [selected, setSelected] = React.useState<Record<string, string>>({}); // roomId → chosenCat
  const [expandedRoom, setExpandedRoom] = React.useState<string | null>(null);

  const isAvailable = (roomId: string, dayIndex: number) => {
    if (roomId === 'r3') return false;
    if (roomId === 'r5' && dayIndex === 2) return false;
    return true;
  };

  const toggleRoom = (room: typeof MOCK_PHYSICAL_ROOMS[0]) => {
    if (selected[room.id] !== undefined) {
      const s = { ...selected };
      delete s[room.id];
      setSelected(s);
      setExpandedRoom(null);
    } else {
      setSelected(s => ({ ...s, [room.id]: room.categories[0] }));
      if (room.categories.length > 1) setExpandedRoom(room.id);
    }
  };

  const total = Object.entries(selected).reduce((sum, [id, cat]) => {
    const r = MOCK_PHYSICAL_ROOMS.find(r => r.id === id);
    const price = r?.pricesByCategory[cat as keyof typeof r.pricesByCategory] ?? 0;
    return sum + price * MOCK_DATES.nights;
  }, 0);

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Visuel matrix. Delte rum viser en kategori-vælger nedad når rækken klikkes.
      </p>
      <DateBar />
      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '500px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.8125rem', color: '#888', borderBottom: '1px solid #e0e0e0', minWidth: '160px' }}>
                Værelse
              </th>
              {DAYS.map((d, i) => (
                <th key={i} style={{ padding: '0.625rem 0.75rem', fontSize: '0.8125rem', color: '#888', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
                  <div>{d}</div>
                  <div style={{ fontWeight: 400, color: '#aaa', fontSize: '0.75rem' }}>{DATES_LABEL[i]}</div>
                </th>
              ))}
              <th style={{ padding: '0.625rem 0.75rem', fontSize: '0.8125rem', color: '#888', borderBottom: '1px solid #e0e0e0', textAlign: 'right' }}>Pris/nat</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PHYSICAL_ROOMS.map(room => {
              const isRowSelected = selected[room.id] !== undefined;
              const chosenCat = selected[room.id] ?? room.categories[0];
              const chosenPrice = room.pricesByCategory[chosenCat as keyof typeof room.pricesByCategory] ?? 0;
              const rowAvailable = room.available;
              const isExpanded = expandedRoom === room.id;
              return (
                <React.Fragment key={room.id}>
                  <tr style={{
                    background: isRowSelected ? 'rgba(124,58,237,0.04)' : undefined,
                    cursor: rowAvailable ? 'pointer' : 'not-allowed',
                    opacity: rowAvailable ? 1 : 0.45,
                  }} onClick={() => rowAvailable && toggleRoom(room)}>
                    <td style={{ padding: '0.75rem', borderBottom: isExpanded ? 'none' : '1px solid #f0f0f0' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{room.name}</div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        {room.categories.map(c => <span key={c} style={badge(CAT_COLORS[c] ?? '#888')}>{c}</span>)}
                      </div>
                    </td>
                    {DAYS.map((_, i) => {
                      const avail = isAvailable(room.id, i);
                      return (
                        <td key={i} style={{ padding: '0.75rem', borderBottom: isExpanded ? 'none' : '1px solid #f0f0f0', textAlign: 'center' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto',
                            background: avail ? (isRowSelected ? 'var(--color-primary)' : '#d1fae5') : '#fee2e2',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem',
                          }}>
                            {avail ? (isRowSelected ? '✓' : '·') : '×'}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: '0.75rem', borderBottom: isExpanded ? 'none' : '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                      {chosenPrice.toLocaleString('da-DK')} kr
                    </td>
                  </tr>
                  {isExpanded && isRowSelected && room.categories.length > 1 && (
                    <tr>
                      <td colSpan={DAYS.length + 2} style={{ padding: '0 0.75rem 0.75rem', borderBottom: '1px solid #f0f0f0' }}>
                        <InlineCatPicker
                          room={room}
                          chosen={chosenCat}
                          onChange={cat => { setSelected(s => ({ ...s, [room.id]: cat })); setExpandedRoom(null); }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {Object.keys(selected).length > 0 && (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--color-primary)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{Object.keys(selected).length} værelse{Object.keys(selected).length > 1 ? 'r' : ''} valgt</div>
            <div style={{ fontSize: '0.875rem', color: '#888' }}>Total: {total.toLocaleString('da-DK')} kr</div>
          </div>
          <button style={btnPrimary}>Fortsæt →</button>
        </div>
      )}
    </div>
  );
}

// ─── Design 5: "Byg din ophold" booking basket ───────────────────────────────

function Design5() {
  const [pool, setPool] = React.useState<Array<{ id: string; cat: string }>>([]);
  const [pickingCat, setPickingCat] = React.useState<string | null>(null); // room ID pending category pick
  const maxRooms = MOCK_PHYSICAL_ROOMS.filter(r => r.available).length;

  const addRoom = (room: typeof MOCK_PHYSICAL_ROOMS[0]) => {
    if (room.categories.length > 1) {
      setPickingCat(room.id);
    } else {
      setPool(p => [...p, { id: room.id, cat: room.categories[0] }]);
    }
  };

  const confirmCat = (roomId: string, cat: string) => {
    setPool(p => [...p, { id: roomId, cat }]);
    setPickingCat(null);
  };

  const remove = (idx: number) => setPool(p => p.filter((_, i) => i !== idx));

  const total = pool.reduce((s, { id, cat }) => {
    const r = MOCK_PHYSICAL_ROOMS.find(r => r.id === id);
    const price = r?.pricesByCategory[cat as keyof typeof r.pricesByCategory] ?? 0;
    return s + price * MOCK_DATES.nights;
  }, 0);

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Kurv-model — delte rum viser en kategori-vælger inline før de tilføjes kurven. Kurven viser præcis hvad der bookes.
      </p>
      <DateBar />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: available rooms */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#555', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ledige værelser
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {MOCK_PHYSICAL_ROOMS.map(room => {
              const inPool = pool.some(p => p.id === room.id);
              const unavail = !room.available;
              const isPicking = pickingCat === room.id;
              return (
                <div key={room.id} style={{
                  ...card,
                  opacity: unavail ? 0.4 : 1,
                  padding: '0.875rem 1rem',
                  borderColor: inPool ? 'var(--color-primary)' : isPicking ? '#7c3aed' : '#e0e0e0',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                        {room.name}
                        {room.categories.length > 1 && <span style={{ ...badge('#7c3aed'), marginLeft: '0.5rem' }}>Delt</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem' }}>
                        {room.categories.map(c => <span key={c} style={badge(CAT_COLORS[c] ?? '#888')}>{c}</span>)}
                      </div>
                    </div>
                    {unavail ? (
                      <span style={{ fontSize: '0.8125rem', color: '#ef4444' }}>Optaget</span>
                    ) : inPool ? (
                      <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>I kurv ✓</span>
                    ) : (
                      <button onClick={() => addRoom(room)} style={{ ...btnPrimary, padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
                        + Tilføj
                      </button>
                    )}
                  </div>
                  {isPicking && (
                    <div style={{ marginTop: '0.625rem' }}>
                      <InlineCatPicker
                        room={room}
                        chosen={room.categories[0]}
                        onChange={cat => confirmCat(room.id, cat)}
                      />
                      <button onClick={() => setPickingCat(null)} style={{ marginTop: '0.375rem', background: 'none', border: 'none', color: '#888', fontSize: '0.75rem', cursor: 'pointer' }}>
                        Annuller
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: basket */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#555', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Din booking ({pool.length}/{maxRooms})
          </div>
          <div style={{ ...card, minHeight: '120px', borderStyle: pool.length === 0 ? 'dashed' : 'solid', borderColor: pool.length === 0 ? '#ccc' : 'var(--color-primary)' }}>
            {pool.length === 0 ? (
              <div style={{ color: '#bbb', textAlign: 'center', padding: '2rem 1rem', fontSize: '0.875rem' }}>
                Tilføj et værelse fra listen til venstre
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
                  {pool.map(({ id, cat }, idx) => {
                    const room = MOCK_PHYSICAL_ROOMS.find(r => r.id === id)!;
                    const price = room.pricesByCategory[cat as keyof typeof room.pricesByCategory] ?? 0;
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{room.name}</div>
                          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem', alignItems: 'center' }}>
                            <span style={badge(CAT_COLORS[cat] ?? '#888')}>{cat}</span>
                            <span style={{ fontSize: '0.8125rem', color: '#888' }}>{(price * MOCK_DATES.nights).toLocaleString('da-DK')} kr</span>
                          </div>
                        </div>
                        <button onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.125rem' }}>×</button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0' }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.125rem' }}>
                    {total.toLocaleString('da-DK')} kr
                  </span>
                </div>
                <button style={{ ...btnPrimary, width: '100%', marginTop: '1rem' }}>Fortsæt til udfyldelse →</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Design 6: Tier columns (side-by-side category view) ─────────────────────

function Design6() {
  // Each selection: { roomId, categoryName }
  const [selections, setSelections] = React.useState<Array<{ roomId: string; cat: string }>>([]);

  const isSelected = (roomId: string, cat: string) => selections.some(s => s.roomId === roomId && s.cat === cat);
  const isClaimedElsewhere = (roomId: string, cat: string) => selections.some(s => s.roomId === roomId && s.cat !== cat);

  const toggle = (roomId: string, cat: string) => {
    if (isSelected(roomId, cat)) {
      setSelections(s => s.filter(x => !(x.roomId === roomId && x.cat === cat)));
    } else if (!isClaimedElsewhere(roomId, cat)) {
      setSelections(s => [...s, { roomId, cat }]);
    }
  };

  const total = selections.reduce((sum, { roomId, cat }) => {
    const r = MOCK_PHYSICAL_ROOMS.find(r => r.id === roomId);
    return sum + (r?.pricesByCategory[cat as keyof typeof r.pricesByCategory] ?? 0) * MOCK_DATES.nights;
  }, 0);

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Kategorierne vises side om side. Delte rum vises i begge kolonner med forskellig pris — men kan kun vælges i én kolonne.
      </p>
      <DateBar />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {MOCK_CATEGORIES.map(cat => {
          const catRooms = MOCK_PHYSICAL_ROOMS.filter(r => r.categories.includes(cat.name));
          return (
            <div key={cat.id}>
              <div style={{
                padding: '0.5rem 0.75rem', borderRadius: '8px 8px 0 0',
                background: CAT_COLORS[cat.name] ?? '#888', color: '#fff',
                fontWeight: 700, fontSize: '0.9375rem', textAlign: 'center',
              }}>
                {cat.name}
                <span style={{ fontSize: '0.75rem', opacity: 0.85, display: 'block', fontWeight: 400 }}>
                  {cat.available} ledig{cat.available !== 1 ? 'e' : ''}
                </span>
              </div>
              <div style={{ border: `1.5px solid ${CAT_COLORS[cat.name] ?? '#888'}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                {catRooms.map(room => {
                  const price = room.pricesByCategory[cat.name as keyof typeof room.pricesByCategory] ?? 0;
                  const sel = isSelected(room.id, cat.name);
                  const claimed = isClaimedElsewhere(room.id, cat.name);
                  const unavail = !room.available;
                  return (
                    <div key={room.id} onClick={() => !unavail && !claimed && toggle(room.id, cat.name)}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #f0f0f0',
                        background: sel ? `${CAT_COLORS[cat.name]}18` : claimed ? '#f5f5f5' : 'var(--color-surface)',
                        cursor: unavail || claimed ? 'not-allowed' : 'pointer',
                        opacity: unavail ? 0.4 : 1,
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{room.name}</div>
                          {room.categories.length > 1 && (
                            <div style={{ fontSize: '0.7rem', color: '#7c3aed', marginTop: '0.1rem' }}>Delt rum</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.8125rem' }}>
                          {claimed ? (
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Valgt som {selections.find(s => s.roomId === room.id)?.cat}</span>
                          ) : unavail ? (
                            <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>Optaget</span>
                          ) : (
                            <>
                              <div style={{ fontWeight: 700, color: CAT_COLORS[cat.name] }}>{price.toLocaleString('da-DK')} kr</div>
                              <div style={{ color: '#aaa', fontSize: '0.7rem' }}>/nat</div>
                            </>
                          )}
                        </div>
                      </div>
                      {sel && <div style={{ fontSize: '0.75rem', color: CAT_COLORS[cat.name], marginTop: '0.25rem', fontWeight: 600 }}>✓ Valgt</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {selections.length > 0 && (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--color-primary)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{selections.length} værelse{selections.length > 1 ? 'r' : ''} valgt</div>
            <div style={{ fontSize: '0.875rem', color: '#888' }}>Total: {total.toLocaleString('da-DK')} kr</div>
          </div>
          <button style={btnPrimary}>Fortsæt →</button>
        </div>
      )}
    </div>
  );
}

// ─── Design 7: Price-first — rate cards sorted by price ──────────────────────

interface RateCard {
  id: string;
  roomId: string;
  roomName: string;
  cat: string;
  label: string;
  pricePerNight: number;
  cancellationDays: number;
}

const ALL_RATE_CARDS: RateCard[] = MOCK_PHYSICAL_ROOMS
  .filter(r => r.available)
  .flatMap(room =>
    room.categories.flatMap(cat => {
      const price = room.pricesByCategory[cat as keyof typeof room.pricesByCategory] ?? 0;
      const catRates = MOCK_RATES[cat.toLowerCase()] ?? [];
      return catRates.map(rate => ({
        id: `${room.id}-${cat}-${rate.label}`,
        roomId: room.id,
        roomName: room.name,
        cat,
        label: rate.label,
        pricePerNight: price * (rate.pricePerNight / (MOCK_RATES[cat.toLowerCase()]?.[0]?.pricePerNight ?? 1)),
        cancellationDays: rate.cancellationDays,
      }));
    })
  )
  .sort((a, b) => a.pricePerNight - b.pricePerNight);

function Design7() {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [filterCat, setFilterCat] = React.useState('');

  const toggle = (card: RateCard) => {
    // A room can only be selected once (one rate per physical room)
    const conflictId = [...selected].find(id => {
      const c = ALL_RATE_CARDS.find(r => r.id === id);
      return c?.roomId === card.roomId;
    });
    const s = new Set(selected);
    if (s.has(card.id)) {
      s.delete(card.id);
    } else {
      if (conflictId) s.delete(conflictId);
      s.add(card.id);
    }
    setSelected(s);
  };

  const visible = filterCat ? ALL_RATE_CARDS.filter(c => c.cat === filterCat) : ALL_RATE_CARDS;
  const total = [...selected].reduce((sum, id) => {
    const c = ALL_RATE_CARDS.find(r => r.id === id);
    return sum + (c ? c.pricePerNight * MOCK_DATES.nights : 0);
  }, 0);

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Alle tilgængelige rater vises som kort, sorteret billigst→dyrest. Hvert kort = ét værelse + kategori + ratetype. Filtrér efter kategori.
      </p>
      <DateBar />
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['', 'Standard', 'Deluxe', 'Premium'].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{
            padding: '0.375rem 0.875rem', borderRadius: '999px',
            border: filterCat === cat ? 'none' : '1px solid #e0e0e0',
            background: filterCat === cat ? (CAT_COLORS[cat] ?? 'var(--color-primary)') : 'var(--color-surface)',
            color: filterCat === cat ? '#fff' : 'var(--color-text)',
            cursor: 'pointer', fontSize: '0.8125rem', fontWeight: filterCat === cat ? 700 : 400,
          }}>
            {cat || 'Alle'}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {visible.map(rc => {
          const sel = selected.has(rc.id);
          const conflict = !sel && [...selected].some(id => ALL_RATE_CARDS.find(r => r.id === id)?.roomId === rc.roomId);
          return (
            <div key={rc.id} onClick={() => !conflict && toggle(rc)} style={{
              ...card,
              border: sel ? `2px solid ${CAT_COLORS[rc.cat] ?? 'var(--color-primary)'}` : '1px solid #e0e0e0',
              opacity: conflict ? 0.4 : 1,
              cursor: conflict ? 'not-allowed' : 'pointer',
              position: 'relative',
            }}>
              {conflict && <div style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', fontSize: '0.7rem', color: '#9ca3af' }}>Allerede valgt</div>}
              <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem' }}>
                <span style={badge(CAT_COLORS[rc.cat] ?? '#888')}>{rc.cat}</span>
                {rc.cancellationDays > 0
                  ? <span style={badge('#10b981')}>Gratis afbest.</span>
                  : <span style={badge('#f59e0b')}>Ikke-refund.</span>}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.125rem' }}>{rc.roomName}</div>
              <div style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '0.625rem' }}>{rc.label}</div>
              <div style={{ fontWeight: 700, color: CAT_COLORS[rc.cat] ?? 'var(--color-primary)', fontSize: '1.0625rem' }}>
                {Math.round(rc.pricePerNight).toLocaleString('da-DK')} kr/nat
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#888' }}>
                {Math.round(rc.pricePerNight * MOCK_DATES.nights).toLocaleString('da-DK')} kr total
              </div>
            </div>
          );
        })}
      </div>
      {selected.size > 0 && (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--color-primary)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{selected.size} værelse{selected.size > 1 ? 'r' : ''} valgt</div>
            <div style={{ fontSize: '0.875rem', color: '#888' }}>Total: {total.toLocaleString('da-DK')} kr</div>
          </div>
          <button style={btnPrimary}>Fortsæt →</button>
        </div>
      )}
    </div>
  );
}

// ─── Design 8: Split-screen live builder ─────────────────────────────────────

function Design8() {
  type LineItem = { roomId: string; cat: string; rateIdx: number };
  const [items, setItems] = React.useState<LineItem[]>([]);
  const [activeRoom, setActiveRoom] = React.useState<string | null>(null);
  const [activeCat, setActiveCat] = React.useState<string>('');

  const claimedRoomIds = new Set(items.map(i => i.roomId));

  const selectRoom = (room: typeof MOCK_PHYSICAL_ROOMS[0]) => {
    if (claimedRoomIds.has(room.id)) return;
    setActiveRoom(room.id);
    setActiveCat(room.categories[0]);
  };

  const addItem = (rateIdx: number) => {
    if (!activeRoom || !activeCat) return;
    setItems(prev => [...prev, { roomId: activeRoom, cat: activeCat, rateIdx }]);
    setActiveRoom(null);
    setActiveCat('');
  };

  const remove = (idx: number) => setItems(p => p.filter((_, i) => i !== idx));

  const room = MOCK_PHYSICAL_ROOMS.find(r => r.id === activeRoom);
  const rates = MOCK_RATES[activeCat.toLowerCase()] ?? [];
  const basePrice = room?.pricesByCategory[activeCat as keyof typeof room.pricesByCategory] ?? 0;

  const total = items.reduce((sum, { roomId, cat, rateIdx }) => {
    const r = MOCK_PHYSICAL_ROOMS.find(r => r.id === roomId);
    const base = r?.pricesByCategory[cat as keyof typeof r.pricesByCategory] ?? 0;
    const catRates = MOCK_RATES[cat.toLowerCase()] ?? [];
    const multiplier = (catRates[rateIdx]?.pricePerNight ?? base) / ((catRates[0]?.pricePerNight ?? base) || 1);
    return sum + base * multiplier * MOCK_DATES.nights;
  }, 0);

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Venstre: vælg rum. Højre: live konfigurator viser kategori- og rate-valgmuligheder for det valgte rum. Delte rum: skift kategori for at se prisskiftet live.
      </p>
      <DateBar />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Left: room list */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: '0.625rem', fontSize: '0.8125rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ledige værelser
          </div>
          {MOCK_PHYSICAL_ROOMS.map(r => {
            const claimed = claimedRoomIds.has(r.id);
            const picking = activeRoom === r.id;
            return (
              <div key={r.id} onClick={() => r.available && !claimed && selectRoom(r)} style={{
                ...card, padding: '0.75rem 1rem', marginBottom: '0.5rem',
                cursor: r.available && !claimed ? 'pointer' : 'not-allowed',
                opacity: !r.available ? 0.4 : 1,
                border: picking ? '2px solid var(--color-primary)' : claimed ? '1px solid #d1fae5' : '1px solid #e0e0e0',
                background: picking ? 'rgba(var(--color-primary-rgb,96,73,60),0.04)' : claimed ? '#f0fdf4' : 'var(--color-surface)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem' }}>
                      {r.categories.map(c => <span key={c} style={badge(CAT_COLORS[c] ?? '#888')}>{c}</span>)}
                    </div>
                  </div>
                  {claimed && <span style={{ color: '#10b981', fontSize: '0.8125rem' }}>✓ Tilføjet</span>}
                  {!claimed && !r.available && <span style={{ color: '#ef4444', fontSize: '0.8125rem' }}>Optaget</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: configurator */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: '0.625rem', fontSize: '0.8125rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Konfigurér valgt værelse
          </div>
          {!activeRoom ? (
            <div style={{ ...card, minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '0.875rem', borderStyle: 'dashed' }}>
              Klik på et værelse til venstre
            </div>
          ) : (
            <div style={{ ...card, borderColor: 'var(--color-primary)' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>{room?.name}</div>

              {/* Category selector for shared rooms */}
              {(room?.categories.length ?? 0) > 1 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8125rem', color: '#555', fontWeight: 600, marginBottom: '0.375rem' }}>Book som kategori:</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {room?.categories.map(cat => {
                      const price = room.pricesByCategory[cat as keyof typeof room.pricesByCategory] ?? 0;
                      return (
                        <button key={cat} onClick={() => setActiveCat(cat)} style={{
                          flex: 1, padding: '0.5rem', borderRadius: '6px', cursor: 'pointer',
                          border: `2px solid ${activeCat === cat ? CAT_COLORS[cat] ?? '#888' : '#e0e0e0'}`,
                          background: activeCat === cat ? `${CAT_COLORS[cat]}18` : 'transparent',
                          fontWeight: activeCat === cat ? 700 : 400,
                          fontSize: '0.8125rem',
                        }}>
                          <div style={{ color: CAT_COLORS[cat] ?? '#888' }}>{cat}</div>
                          <div style={{ fontWeight: 700 }}>{price.toLocaleString('da-DK')} kr</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rate selector */}
              <div style={{ fontSize: '0.8125rem', color: '#555', fontWeight: 600, marginBottom: '0.375rem' }}>Vælg rate:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {rates.map((rate, i) => {
                  const multiplier = rate.pricePerNight / (rates[0]?.pricePerNight ?? 1);
                  const price = Math.round(basePrice * multiplier);
                  return (
                    <div key={i} onClick={() => addItem(i)} style={{
                      ...card, padding: '0.75rem 1rem', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{rate.label}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>
                          {rate.cancellationDays > 0 ? `Gratis afbest. ${rate.cancellationDays} dage` : 'Ikke-refunderbar'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{price.toLocaleString('da-DK')} kr/nat</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{(price * MOCK_DATES.nights).toLocaleString('da-DK')} kr total</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          {items.length > 0 && (
            <div style={{ ...card, marginTop: '0.875rem', borderColor: 'var(--color-primary)' }}>
              {items.map(({ roomId, cat, rateIdx }, idx) => {
                const r = MOCK_PHYSICAL_ROOMS.find(r => r.id === roomId)!;
                const base = r.pricesByCategory[cat as keyof typeof r.pricesByCategory] ?? 0;
                const catRates = MOCK_RATES[cat.toLowerCase()] ?? [];
                const multiplier = (catRates[rateIdx]?.pricePerNight ?? base) / ((catRates[0]?.pricePerNight ?? base) || 1);
                const price = Math.round(base * multiplier);
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.875rem' }}>
                      {r.name} <span style={badge(CAT_COLORS[cat] ?? '#888')}>{cat}</span> · {catRates[rateIdx]?.label}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.875rem' }}>{(price * MOCK_DATES.nights).toLocaleString('da-DK')} kr</span>
                      <button onClick={() => remove(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.625rem', fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--color-primary)' }}>{Math.round(total).toLocaleString('da-DK')} kr</span>
              </div>
              <button style={{ ...btnPrimary, width: '100%', marginTop: '0.75rem' }}>Book →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Design 9: Visual room map (floor plan grid) ─────────────────────────────

function Design9() {
  const [selected, setSelected] = React.useState<Record<string, string>>({}); // roomId → cat
  const [hovered, setHovered] = React.useState<string | null>(null);

  const toggle = (room: typeof MOCK_PHYSICAL_ROOMS[0], cat: string) => {
    if (selected[room.id] === cat) {
      const s = { ...selected }; delete s[room.id]; setSelected(s);
    } else {
      setSelected(s => ({ ...s, [room.id]: cat }));
    }
  };

  const total = Object.entries(selected).reduce((sum, [id, cat]) => {
    const r = MOCK_PHYSICAL_ROOMS.find(r => r.id === id);
    return sum + (r?.pricesByCategory[cat as keyof typeof r.pricesByCategory] ?? 0) * MOCK_DATES.nights;
  }, 0);

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Visuel plantegning — hvert rum er en tile. Delte rum har en farvegradering der viser begge kategorier. Hover for detaljer, klik for at vælge.
      </p>
      <DateBar />

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {Object.entries(CAT_COLORS).map(([name, color]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color }} />
            {name}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#aaa' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#e5e7eb' }} />
          Optaget
        </div>
      </div>

      {/* Room grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {MOCK_PHYSICAL_ROOMS.map(room => {
          const cats = room.categories;
          const isUnavail = !room.available;
          const selCat = selected[room.id];
          const isHovered = hovered === room.id;

          // Gradient background for multi-category rooms
          const bg = isUnavail
            ? '#e5e7eb'
            : cats.length === 1
              ? `${CAT_COLORS[cats[0]] ?? '#888'}22`
              : `linear-gradient(135deg, ${CAT_COLORS[cats[0]] ?? '#888'}30 50%, ${CAT_COLORS[cats[1]] ?? '#888'}30 50%)`;

          const borderColor = selCat ? CAT_COLORS[selCat] ?? 'var(--color-primary)' : isHovered ? '#555' : '#e0e0e0';

          return (
            <div key={room.id}
              onMouseEnter={() => !isUnavail && setHovered(room.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                borderRadius: '10px',
                border: `2px solid ${borderColor}`,
                background: bg,
                padding: '1rem',
                cursor: isUnavail ? 'not-allowed' : 'pointer',
                opacity: isUnavail ? 0.5 : 1,
                transition: 'border-color 0.15s',
                minHeight: '120px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>{room.name}</div>
                {isUnavail ? (
                  <span style={badge('#9ca3af')}>Optaget</span>
                ) : (
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {cats.map(c => <span key={c} style={badge(CAT_COLORS[c] ?? '#888')}>{c}</span>)}
                  </div>
                )}
              </div>

              {/* Category picker shown on hover / when multi-cat */}
              {!isUnavail && (isHovered || selCat) && (
                <div style={{ marginTop: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {cats.map(cat => {
                    const price = room.pricesByCategory[cat as keyof typeof room.pricesByCategory] ?? 0;
                    const isSel = selCat === cat;
                    return (
                      <button key={cat} onClick={() => toggle(room, cat)} style={{
                        padding: '0.375rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
                        border: `1.5px solid ${isSel ? CAT_COLORS[cat] ?? '#888' : 'rgba(0,0,0,0.1)'}`,
                        background: isSel ? CAT_COLORS[cat] ?? '#888' : 'rgba(255,255,255,0.7)',
                        color: isSel ? '#fff' : '#333',
                        fontWeight: isSel ? 700 : 400, fontSize: '0.75rem',
                        display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span>{cat}</span>
                        <span>{price.toLocaleString('da-DK')} kr</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(selected).length > 0 && (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--color-primary)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{Object.keys(selected).length} værelse{Object.keys(selected).length > 1 ? 'r' : ''} valgt</div>
            <div style={{ fontSize: '0.875rem', color: '#888' }}>Total: {total.toLocaleString('da-DK')} kr</div>
          </div>
          <button style={btnPrimary}>Fortsæt →</button>
        </div>
      )}
    </div>
  );
}

// ─── Design 10: Guided concierge (Q&A flow) ──────────────────────────────────

type ConciergeStep = 'guests' | 'budget' | 'flexible' | 'result';

function Design10() {
  const [step, setStep] = React.useState<ConciergeStep>('guests');
  const [guests, setGuests] = React.useState(2);
  const [budget, setBudget] = React.useState<'low' | 'mid' | 'high'>('mid');
  const [flexible, setFlexible] = React.useState<boolean | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);

  // Derive suggestion based on answers
  const suggestion = React.useMemo(() => {
    if (step !== 'result' && step !== 'flexible') return null;
    const budgetMap = { low: 'standard', mid: 'deluxe', high: 'premium' } as const;
    const catId = guests > 3 ? 'standard' : budgetMap[budget];
    const rates = MOCK_RATES[catId] ?? [];
    const rate = flexible ? rates[0] : (rates[1] ?? rates[0]);
    const cat = MOCK_CATEGORIES.find(c => c.id === catId)!;
    const rooms = guests > 3 ? 2 : 1;
    return { cat, rate, rooms, catId };
  }, [step, guests, budget, flexible]);

  const steps: ConciergeStep[] = ['guests', 'budget', 'flexible', 'result'];
  const stepIdx = steps.indexOf(step);

  return (
    <div>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Concierge-flow — tre spørgsmål leder gæsten til en skræddersyet anbefaling. Ingen kategori-forvirring, systemet håndterer delte rum bag scenen.
      </p>
      <DateBar />

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.75rem' }}>
        {['Antal gæster', 'Budget', 'Afbestilling', 'Anbefaling'].map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: i <= stepIdx ? 'var(--color-primary)' : '#bbb' }}>
            <div style={{ height: '3px', borderRadius: '2px', background: i <= stepIdx ? 'var(--color-primary)' : '#e0e0e0', marginBottom: '0.25rem' }} />
            {label}
          </div>
        ))}
      </div>

      {step === 'guests' && (
        <div style={{ ...card, maxWidth: '460px' }}>
          <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '1.25rem' }}>Hvor mange gæster er I?</div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setGuests(n)} style={{
                width: '52px', height: '52px', borderRadius: '50%', cursor: 'pointer',
                border: `2px solid ${guests === n ? 'var(--color-primary)' : '#e0e0e0'}`,
                background: guests === n ? 'var(--color-primary)' : 'transparent',
                color: guests === n ? '#fff' : 'var(--color-text)',
                fontWeight: 700, fontSize: '1.125rem',
              }}>{n}</button>
            ))}
          </div>
          <button style={btnPrimary} onClick={() => setStep('budget')}>Næste →</button>
        </div>
      )}

      {step === 'budget' && (
        <div style={{ ...card, maxWidth: '460px' }}>
          <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '1.25rem' }}>Hvad er jeres budgetpræference?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { id: 'low' as const, label: 'Sparsom', desc: 'Standard komfort, bedste pris', from: 720 },
              { id: 'mid' as const, label: 'Komfort', desc: 'Deluxe oplevelse, god balance', from: 1050 },
              { id: 'high' as const, label: 'Premium', desc: 'Bedste tilgængelige værelse', from: 1550 },
            ].map(b => (
              <div key={b.id} onClick={() => setBudget(b.id)} style={{
                ...card, cursor: 'pointer', padding: '0.875rem 1rem',
                border: `2px solid ${budget === b.id ? 'var(--color-primary)' : '#e0e0e0'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{b.label}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#888' }}>{b.desc}</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>fra {b.from.toLocaleString('da-DK')} kr/nat</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={btnSecondary} onClick={() => setStep('guests')}>← Tilbage</button>
            <button style={btnPrimary} onClick={() => setStep('flexible')}>Næste →</button>
          </div>
        </div>
      )}

      {step === 'flexible' && (
        <div style={{ ...card, maxWidth: '460px' }}>
          <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '1.25rem' }}>Ønsker I gratis afbestilling?</div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { val: true, label: 'Ja', desc: 'Gratis afbest. op til 7 dage før', extra: '+ca. 15%' },
              { val: false, label: 'Nej', desc: 'Ikke-refunderbar, lavere pris', extra: 'Spar 15%' },
            ].map(opt => (
              <div key={String(opt.val)} onClick={() => setFlexible(opt.val)} style={{
                ...card, flex: 1, cursor: 'pointer', padding: '0.875rem',
                border: `2px solid ${flexible === opt.val ? 'var(--color-primary)' : '#e0e0e0'}`,
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: '0.25rem' }}>{opt.label}</div>
                <div style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '0.25rem' }}>{opt.desc}</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: opt.val ? '#6b7280' : '#10b981' }}>{opt.extra}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={btnSecondary} onClick={() => setStep('budget')}>← Tilbage</button>
            <button style={{ ...btnPrimary, opacity: flexible === null ? 0.4 : 1 }}
              disabled={flexible === null} onClick={() => setStep('result')}>Se anbefaling →</button>
          </div>
        </div>
      )}

      {step === 'result' && suggestion && (
        <div style={{ maxWidth: '460px' }}>
          <div style={{ marginBottom: '0.875rem', padding: '0.625rem 1rem', background: '#f0fdf4', borderRadius: '8px', fontSize: '0.8125rem', color: '#166534' }}>
            ✓ Baseret på dine svar anbefaler vi:
          </div>
          <div style={{ ...card, borderColor: CAT_COLORS[suggestion.cat.name] ?? 'var(--color-primary)', borderWidth: '2px' }}>
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
              <span style={badge(CAT_COLORS[suggestion.cat.name] ?? '#888')}>{suggestion.cat.name}</span>
              {suggestion.rate.cancellationDays > 0
                ? <span style={badge('#10b981')}>Gratis afbest.</span>
                : <span style={badge('#f59e0b')}>Ikke-refunderbar</span>}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.25rem' }}>
              {suggestion.rooms} × {suggestion.cat.name} — {suggestion.rate.label}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1rem' }}>
              {suggestion.rooms} værelse{suggestion.rooms > 1 ? 'r' : ''} · {MOCK_DATES.nights} nætter
              {guests > 3 && <span style={{ marginLeft: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>· 2 rum til {guests} gæster</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0' }}>
              <div>
                <div style={{ fontSize: '0.8125rem', color: '#888' }}>Total for opholdet</div>
                <div style={{ fontWeight: 700, fontSize: '1.375rem', color: 'var(--color-primary)' }}>
                  {(suggestion.rate.pricePerNight * MOCK_DATES.nights * suggestion.rooms).toLocaleString('da-DK')} kr
                </div>
              </div>
              {confirmed ? (
                <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Booket!</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <button style={btnPrimary} onClick={() => setConfirmed(true)}>Book dette →</button>
                  <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8125rem' }}
                    onClick={() => setStep('flexible')}>← Tilpas</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DESIGNS = [
  { id: 1, title: 'Generiske rum + rater', subtitle: 'Optagede rum skjules; delte rum: kategori+pris-vælger inline', component: Design1 },
  { id: 2, title: 'Antal → Kategori → Pris', subtitle: 'Wizard — kategori vælges først, delte rum er transparente', component: Design2 },
  { id: 3, title: 'Færdigpakkede kombinationer', subtitle: 'Systemet foreslår mulige pakker', component: Design3 },
  { id: 4, title: 'Tilgængeligheds-matrix', subtitle: 'Tabel: delte rum viser kategori-picker under rækken', component: Design4 },
  { id: 5, title: 'Booking-kurv', subtitle: 'Tilføj rum til kurv; delte rum spørges om kategori', component: Design5 },
  { id: 6, title: 'Kategori-kolonner', subtitle: 'Tre kolonner side om side; delte rum vises i begge', component: Design6 },
  { id: 7, title: 'Rate-kort (pris-first)', subtitle: 'Alle rater som kort sorteret billigst→dyrest', component: Design7 },
  { id: 8, title: 'Split-screen builder', subtitle: 'Vælg rum → live konfigurator til højre', component: Design8 },
  { id: 9, title: 'Visuel plantegning', subtitle: 'Rum som tiles; delte rum gradient; hover = vælg kategori', component: Design9 },
  { id: 10, title: 'Concierge-flow', subtitle: 'Tre spørgsmål → automatisk anbefaling', component: Design10 },
];

export default function BookingMockupPage() {
  const [active, setActive] = React.useState(1);
  const ActiveDesign = DESIGNS.find(d => d.id === active)!.component;

  return (
    <Layout>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            MOCKUP · Kun til internt brug
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', marginBottom: '0.375rem' }}>
            Book Now — Designforslag
          </h1>
          <p style={{ color: '#666', fontSize: '0.9375rem' }}>
            10 alternative flows. Alle håndterer delte rum (rum med flere kategorier + prisforskelle). Ingen backend-kald.
          </p>
        </div>

        {/* Design selector */}
        <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {DESIGNS.map(d => (
            <button key={d.id} onClick={() => setActive(d.id)} style={{
              padding: '0.5rem 0.875rem',
              borderRadius: '8px',
              border: active === d.id ? '2px solid var(--color-primary)' : '1.5px solid #e0e0e0',
              background: active === d.id ? 'var(--color-primary)' : 'var(--color-surface)',
              color: active === d.id ? '#fff' : 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: active === d.id ? 700 : 400,
              textAlign: 'left',
              minWidth: '130px',
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.125rem' }}>#{d.id} {d.title}</div>
              <div style={{ fontSize: '0.6875rem', opacity: 0.8 }}>{d.subtitle}</div>
            </button>
          ))}
        </div>

        {/* Active design */}
        <div style={{ ...card, padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e0e0e0' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '0.25rem' }}>
              #{active} — {DESIGNS.find(d => d.id === active)!.title}
            </h2>
            <p style={{ color: '#888', fontSize: '0.875rem', margin: 0 }}>
              {DESIGNS.find(d => d.id === active)!.subtitle}
            </p>
          </div>
          <ActiveDesign />
        </div>

        {/* Notes */}
        <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: '#f8f8f8', borderRadius: '8px', fontSize: '0.8125rem', color: '#666', lineHeight: 1.6 }}>
          <strong>Grundprincip:</strong> Gæster booker en <em>kategori-slot</em>, ikke et fysisk rum — værtsparret tildeler rum efter booking.
          {' '}#1 er den rene kategori-model: stepper + rate-vælger, ingen rum synlige.
          {' '}#4/#5/#9 viser fysiske rum med inline kategori-vælger for delte rum.
          {' '}#6 forhindrer dobbeltselektion på tværs af kolonner.
          {' '}#7 eksponerer rum+kategori som ét valg per kort.
          {' '}#8 live konfigurator: skift kategori og se prisen opdatere øjeblikkeligt.
          {' '}#2/#3/#10 skjuler al kompleksitet bag systemet.
        </div>
      </div>
    </Layout>
  );
}
