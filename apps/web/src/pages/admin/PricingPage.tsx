import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from './AdminLayout';
import { useConfirm } from '../../components/ConfirmDialog';
import { apiClient } from '../../hooks/useApi';
import type { PriceCategory, PriceCategoryDay, RoomCategory, Charge } from '@dagmar/shared';

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500,
};

const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun display order
const WEEKDAY_COLORS: Record<number, string> = { 0: '#7c6f4e', 6: '#7c6f4e' }; // Sat+Sun=warm muted brown

interface EditState {
  categoryId: string;
  date: string;
  day: PriceCategoryDay | null;
  anchorRect: DOMRect;
  isMain: boolean;
}

type RestrictField = 'arrivalAllowed' | 'departureAllowed' | 'minStayNights' | 'minAdvanceBookingDays' | 'cancellationDays';

interface RestrictEditState {
  categoryId: string;
  date: string;
  day: PriceCategoryDay | null;
  field: RestrictField;
  anchorRect: DOMRect;
}

// ── DiscountCodesPanel ───────────────────────────────────────────────────────

interface DiscountCode {
  id: string;
  type: string;
  code: string;
  name?: string;
  batchId?: string;
  discountPercent: number;
  validFrom: string;
  validTo: string;
  usageCount: number;
  status: string;
  usedByBookingId?: string;
  createdAt: string;
}

function DiscountCodesPanel({ t }: { t: (key: string, opts?: any) => string }) {
  const { confirm: confirmDialog, dialog } = useConfirm();
  const [codes, setCodes] = React.useState<DiscountCode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeView, setActiveView] = React.useState<'MULTI' | 'SINGLE'>('MULTI');
  const [showWizard, setShowWizard] = React.useState(false);
  const [wizardType, setWizardType] = React.useState<'MULTI' | 'SINGLE' | null>(null);
  const [wizardStep, setWizardStep] = React.useState<1 | 2>(1);
  const [wizardForm, setWizardForm] = React.useState({
    name: '', code: '', discountPercent: '', validFrom: '', validTo: '', count: '1',
  });
  const [saving, setSaving] = React.useState(false);
  const [wizardError, setWizardError] = React.useState('');
  const [expandedBatches, setExpandedBatches] = React.useState<Set<string>>(new Set());

  const loadCodes = async () => {
    try {
      const res = await apiClient.get<DiscountCode[]>('/discount-codes');
      setCodes(res.data);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadCodes(); }, []);

  const resetWizard = () => {
    setShowWizard(false);
    setWizardType(null);
    setWizardStep(1);
    setWizardForm({ name: '', code: '', discountPercent: '', validFrom: '', validTo: '', count: '1' });
    setWizardError('');
  };

  const submitWizard = async () => {
    setSaving(true);
    setWizardError('');
    try {
      const pct = parseFloat(wizardForm.discountPercent);
      if (isNaN(pct) || pct < 1 || pct > 100) { setWizardError('Discount must be 1–100'); return; }
      if (!wizardForm.validFrom || !wizardForm.validTo) { setWizardError('Valid from/to required'); return; }
      if (wizardType === 'MULTI') {
        if (wizardForm.code.length < 3) { setWizardError('Code must be at least 3 characters'); return; }
        await apiClient.post('/discount-codes', {
          type: 'MULTI',
          code: wizardForm.code.trim(),
          discountPercent: pct,
          validFrom: wizardForm.validFrom,
          validTo: wizardForm.validTo,
        });
      } else {
        const count = parseInt(wizardForm.count);
        if (isNaN(count) || count < 1) { setWizardError('Count must be at least 1'); return; }
        await apiClient.post('/discount-codes', {
          type: 'SINGLE',
          count,
          discountPercent: pct,
          validFrom: wizardForm.validFrom,
          validTo: wizardForm.validTo,
        });
      }
      resetWizard();
      loadCodes();
    } catch (err: any) {
      setWizardError(err.response?.data?.error || 'Error creating code');
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (id: string, status: 'FREE' | 'HANDED') => {
    try {
      await apiClient.patch(`/discount-codes/${id}/status`, { status });
      setCodes(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error updating status');
    }
  };

  const deleteCode = async (id: string) => {
    if (!await confirmDialog({ title: t('common.confirm_delete'), message: t('common.cannot_undo'), variant: 'danger' })) return;
    await apiClient.delete(`/discount-codes/${id}`);
    setCodes(prev => prev.filter(c => c.id !== id));
  };

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const multiCodes = codes.filter(c => c.type === 'MULTI');
  const singleCodes = codes.filter(c => c.type === 'SINGLE');
  const batches = Array.from(new Map(
    singleCodes.map(c => [c.batchId!, c])
  ).entries()).map(([batchId]) => ({
    batchId,
    codes: singleCodes.filter(c => c.batchId === batchId),
  }));

  const statusColor = (s: string) => s === 'FREE' ? '#10b981' : s === 'HANDED' ? '#f59e0b' : '#ef4444';
  const statusLabel = (s: string) =>
    s === 'FREE' ? t('admin.discount_status_free')
    : s === 'HANDED' ? t('admin.discount_status_handed')
    : t('admin.discount_status_used');

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('da-DK');

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>{t('common.loading')}</div>;

  return (
    <div>
      {dialog}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem' }}>{t('admin.discount_codes')}</h2>
        <button onClick={() => setShowWizard(true)} className="btn-primary" style={{ fontSize: '0.875rem' }}>
          + {t('admin.new_discount_code')}
        </button>
      </div>

      {/* Wizard modal */}
      {showWizard && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            {wizardStep === 1 && (
              <>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.5rem' }}>{t('admin.new_discount_code')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  {[
                    { type: 'MULTI' as const, title: t('admin.discount_type_multi'), desc: t('admin.discount_type_multi_desc') },
                    { type: 'SINGLE' as const, title: t('admin.discount_type_single'), desc: t('admin.discount_type_single_desc') },
                  ].map(opt => (
                    <button key={opt.type} onClick={() => { setWizardType(opt.type); setWizardStep(2); }}
                      style={{
                        padding: '1.25rem', border: `2px solid ${wizardType === opt.type ? 'var(--color-primary)' : '#e0e0e0'}`,
                        borderRadius: '8px', background: 'none', cursor: 'pointer', textAlign: 'left',
                      }}>
                      <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.375rem' }}>{opt.title}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#666' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <button onClick={resetWizard} className="btn-secondary" style={{ width: '100%' }}>{t('common.cancel')}</button>
              </>
            )}
            {wizardStep === 2 && wizardType && (
              <>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.5rem' }}>
                  {wizardType === 'MULTI' ? t('admin.discount_type_multi') : t('admin.discount_type_single')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {wizardType === 'MULTI' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>{t('admin.discount_code_label')}</label>
                      <input className="input-field" value={wizardForm.code} onChange={e => setWizardForm(f => ({ ...f, code: e.target.value }))} placeholder="SUMMER20" autoFocus />
                    </div>
                  )}
                  {wizardType === 'SINGLE' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>{t('admin.discount_code_count')}</label>
                      <input className="input-field" type="number" min="1" max="500" value={wizardForm.count} onChange={e => setWizardForm(f => ({ ...f, count: e.target.value }))} autoFocus />
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>{t('admin.discount_percent')}</label>
                    <input className="input-field" type="number" min="1" max="100" value={wizardForm.discountPercent} onChange={e => setWizardForm(f => ({ ...f, discountPercent: e.target.value }))} placeholder="10" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>{t('admin.discount_valid_from')}</label>
                      <input className="input-field" type="date" value={wizardForm.validFrom} onChange={e => setWizardForm(f => ({ ...f, validFrom: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>{t('admin.discount_valid_to')}</label>
                      <input className="input-field" type="date" value={wizardForm.validTo} onChange={e => setWizardForm(f => ({ ...f, validTo: e.target.value }))} />
                    </div>
                  </div>
                </div>
                {wizardError && <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.75rem' }}>{wizardError}</div>}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button onClick={() => setWizardStep(1)} className="btn-secondary">{t('common.cancel')}</button>
                  <button onClick={submitWizard} className="btn-primary" disabled={saving} style={{ flex: 1 }}>
                    {saving ? t('common.loading') : t('common.save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* View switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', borderBottom: '2px solid #e0e0e0' }}>
        {([['MULTI', t('admin.multi_codes_title')], ['SINGLE', t('admin.single_codes_title')]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveView(key)} style={{
            padding: '0.625rem 1.25rem', fontSize: '0.9375rem', background: 'none', border: 'none',
            cursor: 'pointer', fontWeight: activeView === key ? 600 : 400,
            color: activeView === key ? 'var(--color-primary)' : '#555',
            borderBottom: `2px solid ${activeView === key ? 'var(--color-primary)' : 'transparent'}`,
            marginBottom: '-2px',
          }}>{label}</button>
        ))}
      </div>

      {/* Multi-use codes */}
      {activeView === 'MULTI' && <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', marginBottom: '0.75rem' }}>{t('admin.multi_codes_title')}</h3>
        <div className="card" style={{ padding: '1rem' }}>
          {multiCodes.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.875rem' }}>{t('admin.no_discount_codes')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e0e0e0', color: '#666', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{t('admin.discount_code_label')}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{t('admin.discount_percent')}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{t('admin.discount_valid_from')} – {t('admin.discount_valid_to')}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>{t('admin.usage_count')}</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {multiCodes.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>{c.code}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>{c.discountPercent}%</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#666' }}>{fmtDate(c.validFrom)} – {fmtDate(c.validTo)}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>{c.usageCount}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <button onClick={() => deleteCode(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.875rem' }}>{t('common.delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>}

      {/* Single-use codes grouped by batch */}
      {activeView === 'SINGLE' && <section>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.0625rem', marginBottom: '0.75rem' }}>{t('admin.single_codes_title')}</h3>
        {batches.length === 0 ? (
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ color: '#888', fontSize: '0.875rem' }}>{t('admin.no_discount_codes')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {batches.map(({ batchId, codes: batchCodes }) => {
              const first = batchCodes[0];
              const isOpen = expandedBatches.has(batchId);
              return (
                <div key={batchId} className="card" style={{ padding: '0' }}>
                  <button onClick={() => toggleBatch(batchId)} style={{
                    width: '100%', padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem',
                  }}>
                    <span>
                      <strong>{t('admin.discount_batch')}: {fmtDate(first.createdAt)}</strong>
                      {' — '}{first.discountPercent}%
                      {' — '}{batchCodes.length} {t('admin.discount_code_count').toLowerCase()}
                      {' — '}{fmtDate(first.validFrom)}–{fmtDate(first.validTo)}
                    </span>
                    <span style={{ color: '#999' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ borderTop: '1px solid #e0e0e0', color: '#666', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 1rem' }}>{t('admin.discount_code_label')}</th>
                          <th style={{ padding: '0.5rem 1rem' }}>Status</th>
                          <th style={{ padding: '0.5rem 1rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchCodes.map(bc => (
                          <tr key={bc.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{bc.code}</td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <span style={{ color: statusColor(bc.status), fontWeight: 600 }}>{statusLabel(bc.status)}</span>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              {bc.status === 'FREE' && (
                                <button onClick={() => patchStatus(bc.id, 'HANDED')} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>
                                  {t('admin.mark_handed')}
                                </button>
                              )}
                              {bc.status === 'HANDED' && (
                                <button onClick={() => patchStatus(bc.id, 'FREE')} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>
                                  {t('admin.mark_free')}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>}
    </div>
  );
}

export default function PricingPage() {
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const [activeSubTab, setActiveSubTab] = React.useState<'pricing' | 'discounts'>('pricing');
  const [categories, setCategories] = React.useState<PriceCategory[]>([]);
  const [roomCategories, setRoomCategories] = React.useState<RoomCategory[]>([]);
  const [charges, setCharges] = React.useState<Charge[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeRoomCatId, setActiveRoomCatId] = React.useState<string>('');

  // Charge management
  const [showAddCharge, setShowAddCharge] = React.useState(false);
  const [newCharge, setNewCharge] = React.useState({ name: '', amountDKK: '' });
  const [savingCharge, setSavingCharge] = React.useState(false);

  const now = new Date();
  const [calYear, setCalYear] = React.useState(now.getFullYear());
  const [calMonth, setCalMonth] = React.useState(now.getMonth());

  const [daysData, setDaysData] = React.useState<Record<string, PriceCategoryDay[]>>({});
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  // Wizard
  const [showWizard, setShowWizard] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState(1);
  const WIZARD_DEFAULTS = {
    name: '', roomCategoryId: '', type: 'main' as 'main' | 'sub',
    parentId: '', savingsPercent: '',
    startDate: '', endDate: '', pricePerNight: '',
    defaultCancellationDays: '7',
    chargeIds: [] as string[],
    copyFromId: '', copySubs: false, copyCustomFields: false,
  };
  const [wizardForm, setWizardForm] = React.useState({ ...WIZARD_DEFAULTS });
  const [savingWizard, setSavingWizard] = React.useState(false);
  const [wizardError, setWizardError] = React.useState('');

  const cancelWizard = () => {
    setShowWizard(false);
    setWizardStep(1);
    setWizardError('');
    setWizardForm({ ...WIZARD_DEFAULTS });
  };

  // All parent days (for restriction modal date range — fetched without month filter)
  const [parentAllDays, setParentAllDays] = React.useState<PriceCategoryDay[]>([]);

  // Restriction rows expansion (per sub-category) — multiple can be open
  const [restrictRowsOpen, setRestrictRowsOpen] = React.useState<Record<string, boolean>>({});
  const toggleRestrictRows = (subId: string) =>
    setRestrictRowsOpen(prev => ({ ...prev, [subId]: !prev[subId] }));

  // Restriction modal
  const [showRestriction, setShowRestriction] = React.useState(false);
  const [restrictForm, setRestrictForm] = React.useState({
    categoryId: '', startDate: '', endDate: '', daysOfWeek: [] as number[],
    field: 'arrivalAllowed' as 'arrivalAllowed' | 'departureAllowed' | 'minAdvanceBookingDays' | 'minStayNights' | 'cancellationDays',
    value: '',
  });
  const [savingRestrict, setSavingRestrict] = React.useState(false);

  const openRestrictionModal = (subId: string) => {
    setRestrictForm({ categoryId: subId, startDate: '', endDate: '', daysOfWeek: [], field: 'arrivalAllowed', value: '' });
    setParentAllDays([]);
    setShowRestriction(true);
    const cat = categories.find(c => c.id === subId);
    if (cat?.parentId) {
      apiClient.get<PriceCategoryDay[]>(`/price-categories/${cat.parentId}/days`)
        .then(res => setParentAllDays(res.data))
        .catch(() => {});
    }
  };

  // Inline cell edit
  const [editState, setEditState] = React.useState<EditState | null>(null);
  const [editForm, setEditForm] = React.useState({
    pricePerNight: '', arrivalAllowed: true, departureAllowed: true,
    minAdvanceBookingDays: '0', minStayNights: '1', cancellationDays: '0',
  });
  const [savingEdit, setSavingEdit] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Restriction-cell focused edit
  const [restrictEditState, setRestrictEditState] = React.useState<RestrictEditState | null>(null);
  const [restrictEditValue, setRestrictEditValue] = React.useState<string>('');
  const [savingRestrictEdit, setSavingRestrictEdit] = React.useState(false);
  const restrictPopoverRef = React.useRef<HTMLDivElement>(null);

  // Drag-to-multiselect
  type RowKey = 'price' | RestrictField;
  const [dragSel, setDragSel] = React.useState<{ catId: string; rowKey: RowKey; startDay: number; endDay: number; isMainCat: boolean } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [rangeEdit, setRangeEdit] = React.useState<{ catId: string; rowKey: RowKey; days: number[]; isMainCat: boolean } | null>(null);
  const [rangeEditValue, setRangeEditValue] = React.useState('');
  const [savingRangeEdit, setSavingRangeEdit] = React.useState(false);

  const loadData = async () => {
    try {
      const [catsRes, roomCatsRes, chargesRes] = await Promise.all([
        apiClient.get<PriceCategory[]>('/price-categories'),
        apiClient.get<RoomCategory[]>('/room-categories'),
        apiClient.get<Charge[]>('/charges'),
      ]);
      setCategories(catsRes.data);
      setRoomCategories(roomCatsRes.data);
      setCharges(chargesRes.data);
      if (roomCatsRes.data.length > 0 && !activeRoomCatId) {
        setActiveRoomCatId(roomCatsRes.data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const addCharge = async () => {
    const amount = parseFloat(newCharge.amountDKK);
    if (!newCharge.name.trim() || isNaN(amount)) return;
    setSavingCharge(true);
    try {
      await apiClient.post('/charges', { name: newCharge.name.trim(), amountDKK: amount });
      setNewCharge({ name: '', amountDKK: '' });
      setShowAddCharge(false);
      const res = await apiClient.get<Charge[]>('/charges');
      setCharges(res.data);
    } finally {
      setSavingCharge(false);
    }
  };

  const deleteCharge = async (id: string) => {
    if (!await confirm({ title: t('common.confirm_delete'), message: t('common.cannot_undo'), variant: 'danger' })) return;
    await apiClient.delete(`/charges/${id}`);
    setCharges(prev => prev.filter(c => c.id !== id));
  };

  React.useEffect(() => { loadData(); }, []);

  const loadMonthDays = React.useCallback((catId: string) => {
    const from = new Date(calYear, calMonth, 1).toISOString().slice(0, 10);
    const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
    const to = new Date(calYear, calMonth, lastDay).toISOString().slice(0, 10);
    apiClient.get<PriceCategoryDay[]>(`/price-categories/${catId}/days?from=${from}&to=${to}`)
      .then(res => setDaysData(prev => ({ ...prev, [catId]: res.data })))
      .catch(() => {});
  }, [calYear, calMonth]);

  React.useEffect(() => {
    if (!activeRoomCatId) return;
    const visibleCats = categories.filter(c => c.roomCategoryId === activeRoomCatId);
    visibleCats.forEach(cat => loadMonthDays(cat.id));
  }, [calYear, calMonth, activeRoomCatId, categories.length, loadMonthDays]);

  // Close popover on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setEditState(null);
      }
    };
    if (editState) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editState]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (restrictPopoverRef.current && !restrictPopoverRef.current.contains(e.target as Node)) {
        setRestrictEditState(null);
      }
    };
    if (restrictEditState) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [restrictEditState]);

  // Drag selection
  React.useEffect(() => {
    const onMouseUp = () => {
      if (!isDragging || !dragSel) return;
      setIsDragging(false);
      const minDay = Math.min(dragSel.startDay, dragSel.endDay);
      const maxDay = Math.max(dragSel.startDay, dragSel.endDay);
      const days = Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i);

      if (days.length === 1) {
        // Single cell — use existing per-cell behaviour; clear drag highlight
        setDragSel(null);
      } else {
        // Multi-cell — open range edit modal
        const isBool = dragSel.rowKey === 'arrivalAllowed' || dragSel.rowKey === 'departureAllowed';
        setRangeEditValue(isBool ? 'true' : dragSel.rowKey === 'minStayNights' ? '1' : '0');
        setRangeEdit({ catId: dragSel.catId, rowKey: dragSel.rowKey, days, isMainCat: dragSel.isMainCat });
        setDragSel(null);
      }
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [isDragging, dragSel]);

  const startDrag = (catId: string, rowKey: RowKey, day: number, isMainCat: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragSel({ catId, rowKey, startDay: day, endDay: day, isMainCat });
    setRangeEdit(null);
  };

  const extendDrag = (catId: string, rowKey: RowKey, day: number) => {
    if (!isDragging || !dragSel || dragSel.catId !== catId || dragSel.rowKey !== rowKey) return;
    setDragSel(prev => prev ? { ...prev, endDay: day } : null);
  };

  const isSelected = (catId: string, rowKey: RowKey, day: number): boolean => {
    const sel = dragSel ?? (rangeEdit ? { catId: rangeEdit.catId, rowKey: rangeEdit.rowKey, startDay: rangeEdit.days[0], endDay: rangeEdit.days[rangeEdit.days.length - 1] } : null);
    if (!sel || sel.catId !== catId || sel.rowKey !== rowKey) return false;
    const lo = Math.min(sel.startDay, sel.endDay);
    const hi = Math.max(sel.startDay, sel.endDay);
    return day >= lo && day <= hi;
  };

  const saveRangeEdit = async () => {
    if (!rangeEdit) return;
    setSavingRangeEdit(true);
    const { catId, rowKey, days, isMainCat } = rangeEdit;
    const isBool = rowKey === 'arrivalAllowed' || rowKey === 'departureAllowed';
    const value: any = isBool ? rangeEditValue === 'true' : (parseFloat(rangeEditValue) || 0);
    try {
      const dates = days.map(d => new Date(calYear, calMonth, d).toISOString().slice(0, 10));
      if (rowKey === 'price') {
        await Promise.all(dates.map(date =>
          apiClient.patch(`/price-categories/${catId}/days/${date}`, { pricePerNight: value, isCustom: true })
        ));
        if (isMainCat) {
          const subs = categories.filter(c => c.parentId === catId && c.savingsPercent != null);
          await Promise.all(subs.map(async sub => {
            const derived = Math.round(value * (1 - sub.savingsPercent! / 100) * 100) / 100;
            await Promise.all(dates.map(date =>
              apiClient.patch(`/price-categories/${sub.id}/days/${date}`, { pricePerNight: derived, isCustom: false })
            ));
            loadMonthDays(sub.id);
          }));
        }
      } else {
        await Promise.all(dates.map(date =>
          apiClient.patch(`/price-categories/${catId}/days/${date}`, { [rowKey]: value, isCustom: true })
        ));
      }
      loadMonthDays(catId);
      setRangeEdit(null);
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingRangeEdit(false);
    }
  };

  const getDayRecord = (catId: string, day: number) => {
    const days = daysData[catId] ?? [];
    const target = new Date(calYear, calMonth, day).toISOString().slice(0, 10);
    return days.find(d => d.date.slice(0, 10) === target);
  };

  const toggleBoolRestrict = async (catId: string, day: number, field: 'arrivalAllowed' | 'departureAllowed') => {
    const dateStr = new Date(calYear, calMonth, day).toISOString().slice(0, 10);
    const existing = getDayRecord(catId, day);
    const current = existing ? (existing as any)[field] as boolean : true;
    try {
      await apiClient.patch(`/price-categories/${catId}/days/${dateStr}`, { [field]: !current, isCustom: true });
      loadMonthDays(catId);
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    }
  };

  const openRestrictEdit = (catId: string, day: number, field: RestrictField, e: React.MouseEvent<HTMLTableCellElement>) => {
    e.stopPropagation();
    const dateStr = new Date(calYear, calMonth, day).toISOString().slice(0, 10);
    const existing = getDayRecord(catId, day);
    setRestrictEditState({ categoryId: catId, date: dateStr, day: existing ?? null, field, anchorRect: e.currentTarget.getBoundingClientRect() });
    const val = existing ? (existing as any)[field] : (field === 'arrivalAllowed' || field === 'departureAllowed' ? true : field === 'minStayNights' ? 1 : 0);
    setRestrictEditValue(typeof val === 'boolean' ? String(val) : String(val));
  };

  const saveRestrictEdit = async () => {
    if (!restrictEditState) return;
    setSavingRestrictEdit(true);
    const { categoryId, date, field } = restrictEditState;
    const isBool = field === 'arrivalAllowed' || field === 'departureAllowed';
    const value = isBool ? restrictEditValue === 'true' : parseInt(restrictEditValue) || 0;
    try {
      await apiClient.patch(`/price-categories/${categoryId}/days/${date}`, { [field]: value, isCustom: true });
      loadMonthDays(categoryId);
      setRestrictEditState(null);
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingRestrictEdit(false);
    }
  };

  const getRestrictPopoverStyle = (): React.CSSProperties => {
    if (!restrictEditState) return {};
    const r = restrictEditState.anchorRect;
    let top = r.bottom + window.scrollY + 6;
    let left = r.left + window.scrollX;
    const popoverWidth = 220;
    if (left + popoverWidth > window.innerWidth - 16) left = window.innerWidth - popoverWidth - 16;
    return { position: 'absolute', top, left, width: popoverWidth, zIndex: 2000 };
  };

  const visibleMainCats = categories.filter(c => c.roomCategoryId === activeRoomCatId && !c.parentId);
  const subCatsByParent: Record<string, PriceCategory[]> = {};
  categories
    .filter(c => c.roomCategoryId === activeRoomCatId && c.parentId)
    .forEach(c => {
      if (!subCatsByParent[c.parentId!]) subCatsByParent[c.parentId!] = [];
      subCatsByParent[c.parentId!].push(c);
    });

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });


  const getDayOfWeek = (day: number) => new Date(calYear, calMonth, day).getDay();

  const openEditDay = (catId: string, day: number, e: React.MouseEvent<HTMLTableCellElement>, isMain = true) => {
    const dateStr = new Date(calYear, calMonth, day).toISOString().slice(0, 10);
    const existing = getDayRecord(catId, day);
    setEditState({ categoryId: catId, date: dateStr, day: existing ?? null, anchorRect: e.currentTarget.getBoundingClientRect(), isMain });
    setEditForm({
      pricePerNight: existing?.pricePerNight?.toString() ?? '',
      arrivalAllowed: existing?.arrivalAllowed ?? true,
      departureAllowed: existing?.departureAllowed ?? true,
      minAdvanceBookingDays: existing?.minAdvanceBookingDays?.toString() ?? '0',
      minStayNights: existing?.minStayNights?.toString() ?? '1',
      cancellationDays: existing?.cancellationDays?.toString() ?? '0',
    });
  };

  const saveEditDay = async () => {
    if (!editState) return;
    setSavingEdit(true);
    try {
      const payload: Record<string, any> = {
        arrivalAllowed: editForm.arrivalAllowed,
        departureAllowed: editForm.departureAllowed,
        minAdvanceBookingDays: parseInt(editForm.minAdvanceBookingDays) || 0,
        minStayNights: parseInt(editForm.minStayNights) || 1,
        cancellationDays: parseInt(editForm.cancellationDays) || 0,
      };
      const priceVal = parseFloat(editForm.pricePerNight);
      if (editForm.pricePerNight !== '' && !isNaN(priceVal)) {
        payload.pricePerNight = priceVal;
      }
      await apiClient.patch(`/price-categories/${editState.categoryId}/days/${editState.date}`, payload);

      // Cascade to sub-categories when editing a main category price
      if (editState.isMain && editForm.pricePerNight !== '' && !isNaN(priceVal)) {
        const subs = categories.filter(c => c.parentId === editState.categoryId && c.savingsPercent != null);
        await Promise.all(subs.map(sub => {
          const derivedPrice = Math.round(priceVal * (1 - sub.savingsPercent! / 100) * 100) / 100;
          return apiClient.patch(`/price-categories/${sub.id}/days/${editState.date}`, {
            pricePerNight: derivedPrice,
            isCustom: false,
          });
        }));
        subs.forEach(sub => loadMonthDays(sub.id));
      }

      loadMonthDays(editState.categoryId);
      setEditState(null);
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleCollapsed = (catId: string) => {
    setCollapsed(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const deleteCategory = async (id: string) => {
    const subCount = categories.filter(c => c.parentId === id).length;
    const message = subCount > 0
      ? t('admin.delete_with_subs', { count: subCount })
      : t('common.cannot_undo');
    if (!await confirm({ title: t('common.confirm_delete'), message, variant: 'danger' })) return;
    await apiClient.delete(`/price-categories/${id}`);
    loadData();
  };

  // Edit charges on existing main category
  const [editChargesModal, setEditChargesModal] = React.useState<{ catId: string; catName: string; chargeIds: string[] } | null>(null);
  const [savingEditCharges, setSavingEditCharges] = React.useState(false);

  const saveEditCharges = async () => {
    if (!editChargesModal) return;
    setSavingEditCharges(true);
    try {
      await apiClient.patch(`/price-categories/${editChargesModal.catId}`, { chargeIds: editChargesModal.chargeIds });
      setCategories(prev => prev.map(c => c.id === editChargesModal.catId
        ? { ...c, charges: charges.filter(ch => editChargesModal.chargeIds.includes(ch.id)).map(ch => ({ priceCategoryId: c.id, chargeId: ch.id, charge: ch })) }
        : c
      ));
      setEditChargesModal(null);
    } finally {
      setSavingEditCharges(false);
    }
  };

  // Rename main category
  const [renamingCatId, setRenamingCatId] = React.useState<string | null>(null);
  const [renamingName, setRenamingName] = React.useState('');
  const [savingRename, setSavingRename] = React.useState(false);

  const startRename = (cat: PriceCategory) => {
    setRenamingCatId(cat.id);
    setRenamingName(cat.name);
  };

  const saveRename = async (catId: string) => {
    if (!renamingName.trim()) { setRenamingCatId(null); return; }
    setSavingRename(true);
    try {
      await apiClient.patch(`/price-categories/${catId}`, { name: renamingName.trim() });
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, name: renamingName.trim() } : c));
    } finally {
      setSavingRename(false);
      setRenamingCatId(null);
    }
  };

  // Bulk price modal
  const [bulkPriceModal, setBulkPriceModal] = React.useState<{ categoryId: string; categoryName: string } | null>(null);
  const [bulkPriceForm, setBulkPriceForm] = React.useState({ price: '', startDate: '', endDate: '', allDates: true, daysOfWeek: [] as number[] });
  const [savingBulk, setSavingBulk] = React.useState(false);

  const saveBulkPrice = async () => {
    if (!bulkPriceModal) return;
    setSavingBulk(true);
    try {
      const priceVal = parseFloat(bulkPriceForm.price);
      if (isNaN(priceVal)) { alert('Invalid price'); return; }

      const catId = bulkPriceModal.categoryId;
      const hasDaysFilter = bulkPriceForm.daysOfWeek.length > 0;
      const subs = categories.filter(c => c.parentId === catId && c.savingsPercent != null);

      if (!hasDaysFilter) {
        // No weekday filter — use wizard endpoint directly
        if (bulkPriceForm.allDates) {
          await apiClient.post(`/price-categories/${catId}/days/wizard`, { pricePerNight: priceVal, updateExistingOnly: true });
        } else {
          await apiClient.post(`/price-categories/${catId}/days/wizard`, {
            pricePerNight: priceVal,
            startDate: bulkPriceForm.startDate,
            endDate: bulkPriceForm.endDate,
          });
        }
        await Promise.all(subs.map(sub => {
          const derivedPrice = Math.round(priceVal * (1 - sub.savingsPercent! / 100) * 100) / 100;
          return apiClient.post(`/price-categories/${sub.id}/days/wizard`, {
            pricePerNight: derivedPrice,
            updateExistingOnly: bulkPriceForm.allDates,
            startDate: bulkPriceForm.allDates ? undefined : bulkPriceForm.startDate,
            endDate: bulkPriceForm.allDates ? undefined : bulkPriceForm.endDate,
          });
        }));
      } else {
        // Weekday filter — generate specific matching dates
        let dates: string[] = [];
        if (bulkPriceForm.allDates) {
          const res = await apiClient.get<PriceCategoryDay[]>(`/price-categories/${catId}/days`);
          dates = res.data
            .filter(d => bulkPriceForm.daysOfWeek.includes(new Date(d.date).getDay()))
            .map(d => new Date(d.date).toISOString().slice(0, 10));
        } else {
          const start = new Date(bulkPriceForm.startDate);
          const end = new Date(bulkPriceForm.endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (bulkPriceForm.daysOfWeek.includes(d.getDay())) {
              dates.push(new Date(d).toISOString().slice(0, 10));
            }
          }
        }
        await Promise.all(dates.map(date =>
          apiClient.patch(`/price-categories/${catId}/days/${date}`, { pricePerNight: priceVal, isCustom: false })
        ));
        await Promise.all(subs.map(async sub => {
          const derivedPrice = Math.round(priceVal * (1 - sub.savingsPercent! / 100) * 100) / 100;
          await Promise.all(dates.map(date =>
            apiClient.patch(`/price-categories/${sub.id}/days/${date}`, { pricePerNight: derivedPrice, isCustom: false })
          ));
        }));
      }

      setBulkPriceModal(null);
      setBulkPriceForm({ price: '', startDate: '', endDate: '', allDates: true, daysOfWeek: [] });
      const visibleCats = categories.filter(c => c.roomCategoryId === activeRoomCatId);
      visibleCats.forEach(cat => loadMonthDays(cat.id));
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingBulk(false);
    }
  };

  // Copy restriction patterns (by day-of-week) from one price category to another
  const copyRestrictions = async (sourceCatId: string, targetCatId: string, startDate: string, endDate: string) => {
    const daysRes = await apiClient.get<any[]>(`/price-categories/${sourceCatId}/days`);
    const days: any[] = daysRes.data;
    if (days.length === 0) return;

    const fields: Array<{ key: string; defaultVal: boolean | number }> = [
      { key: 'arrivalAllowed', defaultVal: true },
      { key: 'departureAllowed', defaultVal: true },
      { key: 'minAdvanceBookingDays', defaultVal: 0 },
      { key: 'minStayNights', defaultVal: 1 },
      { key: 'cancellationDays', defaultVal: 0 },
    ];

    for (const { key, defaultVal } of fields) {
      // Sample one representative value per day-of-week from source
      const dowMap = new Map<number, boolean | number>();
      for (const day of days) {
        const dow = new Date(day.date).getDay();
        if (!dowMap.has(dow)) {
          const raw = day[key];
          dowMap.set(dow, raw === null || raw === undefined ? defaultVal : raw);
        }
      }

      // Group DOWs by non-default value
      const valueToDoWs = new Map<string, number[]>();
      for (const [dow, val] of dowMap.entries()) {
        const isDefault = val === defaultVal || (key === 'cancellationDays' && val === 0);
        if (!isDefault) {
          const vk = String(val);
          if (!valueToDoWs.has(vk)) valueToDoWs.set(vk, []);
          valueToDoWs.get(vk)!.push(dow);
        }
      }

      for (const [valStr, dows] of valueToDoWs.entries()) {
        const value = (key === 'arrivalAllowed' || key === 'departureAllowed')
          ? valStr === 'true'
          : parseInt(valStr);
        await apiClient.post(`/price-categories/${targetCatId}/days/restrict`, {
          startDate,
          endDate,
          daysOfWeek: dows,
          field: key,
          value,
        });
      }
    }
  };

  // Copy individual custom day overrides (isCustom=true) from source to target, matched by month+day
  // NOTE: prices are NOT copied — only restriction fields
  const copyCustomDayOverrides = async (sourceCatId: string, targetCatId: string, startDate: string, endDate: string) => {
    const daysRes = await apiClient.get<any[]>(`/price-categories/${sourceCatId}/days`);
    const customDays = daysRes.data.filter(d => d.isCustom);
    if (customDays.length === 0) return;

    const newStart = new Date(startDate + 'T00:00:00Z');
    const newEnd = new Date(endDate + 'T00:00:00Z');

    for (const day of customDays) {
      const srcDate = new Date(day.date);
      const srcMonth = srcDate.getUTCMonth();
      const srcDay = srcDate.getUTCDate();
      // Map month+day into the new year range (all comparisons in UTC)
      let targetDate = new Date(Date.UTC(newStart.getUTCFullYear(), srcMonth, srcDay));
      if (targetDate < newStart || targetDate > newEnd) {
        targetDate = new Date(Date.UTC(newStart.getUTCFullYear() + 1, srcMonth, srcDay));
      }
      if (targetDate < newStart || targetDate > newEnd) continue;

      const dateStr = targetDate.toISOString().slice(0, 10);
      try {
        await apiClient.patch(`/price-categories/${targetCatId}/days/${dateStr}`, {
          arrivalAllowed: day.arrivalAllowed,
          departureAllowed: day.departureAllowed,
          minAdvanceBookingDays: day.minAdvanceBookingDays,
          minStayNights: day.minStayNights,
          cancellationDays: day.cancellationDays ?? 0,
          isCustom: true,
        });
      } catch {}
    }
  };

  const runWizard = async () => {
    setSavingWizard(true);
    setWizardError('');
    try {
      const payload: any = { name: wizardForm.name, roomCategoryId: wizardForm.roomCategoryId };
      if (wizardForm.type === 'sub') {
        payload.parentId = wizardForm.parentId || null;
        payload.savingsPercent = parseFloat(wizardForm.savingsPercent) || null;
      } else {
        payload.chargeIds = wizardForm.chargeIds;
      }
      const catRes = await apiClient.post<PriceCategory>('/price-categories', payload);
      const newCatId = catRes.data.id;

      if (wizardForm.startDate && wizardForm.endDate) {
        const wizardPayload: any = { startDate: wizardForm.startDate, endDate: wizardForm.endDate };
        if (wizardForm.type === 'main' && wizardForm.pricePerNight) {
          wizardPayload.pricePerNight = parseFloat(wizardForm.pricePerNight);
        }
        await apiClient.post(`/price-categories/${newCatId}/days/wizard`, wizardPayload);

        // Apply default cancellation days for main categories
        if (wizardForm.type === 'main') {
          const cancelDays = parseInt(wizardForm.defaultCancellationDays) || 0;
          if (cancelDays > 0) {
            await apiClient.post(`/price-categories/${newCatId}/days/restrict`, {
              startDate: wizardForm.startDate,
              endDate: wizardForm.endDate,
              field: 'cancellationDays',
              value: cancelDays,
            });
          }
        }

        // Copy restrictions from source category (DOW-based pattern)
        if (wizardForm.copyFromId) {
          await copyRestrictions(wizardForm.copyFromId, newCatId, wizardForm.startDate, wizardForm.endDate);
          if (wizardForm.copyCustomFields) {
            await copyCustomDayOverrides(wizardForm.copyFromId, newCatId, wizardForm.startDate, wizardForm.endDate);
          }
        }
      }

      // Copy sub-categories if requested
      if (wizardForm.type === 'main' && wizardForm.copySubs && wizardForm.copyFromId) {
        const sourceSubs = categories.filter(c => c.parentId === wizardForm.copyFromId);
        for (const sub of sourceSubs) {
          const subRes = await apiClient.post<PriceCategory>('/price-categories', {
            name: sub.name,
            roomCategoryId: wizardForm.roomCategoryId,
            parentId: newCatId,
            savingsPercent: sub.savingsPercent,
          });
          if (wizardForm.startDate && wizardForm.endDate) {
            await apiClient.post(`/price-categories/${subRes.data.id}/days/wizard`, {
              startDate: wizardForm.startDate,
              endDate: wizardForm.endDate,
            });
            // Copy restrictions from source sub-category
            await copyRestrictions(sub.id, subRes.data.id, wizardForm.startDate, wizardForm.endDate);
            if (wizardForm.copyCustomFields) {
              await copyCustomDayOverrides(sub.id, subRes.data.id, wizardForm.startDate, wizardForm.endDate);
            }
          }
        }
      }

      cancelWizard();
      loadData();
    } catch (err: any) {
      setWizardError(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingWizard(false);
    }
  };

  const applyRestriction = async () => {
    setSavingRestrict(true);
    try {
      const catId = restrictForm.categoryId;
      if (restrictForm.startDate && restrictForm.endDate && restrictForm.value) {
        const fieldValue = ['arrivalAllowed', 'departureAllowed'].includes(restrictForm.field)
          ? restrictForm.value === 'true' || restrictForm.value === '1'
          : parseInt(restrictForm.value) || 0;
        await apiClient.post(`/price-categories/${catId}/days/restrict`, {
          startDate: restrictForm.startDate,
          endDate: restrictForm.endDate,
          daysOfWeek: restrictForm.daysOfWeek.length > 0 ? restrictForm.daysOfWeek : undefined,
          field: restrictForm.field,
          value: fieldValue,
        });
      }
      setShowRestriction(false);
      setRestrictForm({ categoryId: '', startDate: '', endDate: '', daysOfWeek: [], field: 'arrivalAllowed', value: '' });
      loadData();
      loadMonthDays(catId);
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingRestrict(false);
    }
  };

  // Popover position: below the cell, clamped to viewport
  const getPopoverStyle = (): React.CSSProperties => {
    if (!editState) return {};
    const r = editState.anchorRect;
    let top = r.bottom + window.scrollY + 6;
    let left = r.left + window.scrollX;
    const popoverWidth = 280;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }
    return { position: 'absolute', top, left, width: popoverWidth, zIndex: 2000 };
  };

  if (loading) return <AdminLayout><div style={{ padding: '4rem', textAlign: 'center' }}>{t('common.loading')}</div></AdminLayout>;

  const selectedParentCats = visibleMainCats; // for sub-cat parent dropdown in wizard

  const subTabs = [
    { key: 'pricing' as const, label: t('admin.tab_price_categories') },
    { key: 'discounts' as const, label: t('admin.discount_codes') },
  ];

  return (
    <AdminLayout>
      {dialog}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', marginBottom: '1.5rem' }}>
        {t('admin.pricing')}
      </h1>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '2rem', borderBottom: '2px solid #e0e0e0' }}>
        {subTabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveSubTab(tab.key)} style={{
            padding: '0.625rem 1.25rem', fontSize: '0.9375rem', background: 'none', border: 'none',
            cursor: 'pointer', fontWeight: activeSubTab === tab.key ? 600 : 400,
            color: activeSubTab === tab.key ? 'var(--color-primary)' : '#555',
            borderBottom: `2px solid ${activeSubTab === tab.key ? 'var(--color-primary)' : 'transparent'}`,
            marginBottom: '-2px',
          }}>{tab.label}</button>
        ))}
      </div>

      {activeSubTab === 'discounts' && <DiscountCodesPanel t={t} />}

      {activeSubTab === 'pricing' && <>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem' }}>
          {t('admin.price_categories')}
        </h2>
        <button onClick={() => setShowWizard(true)} className="btn-primary" style={{ fontSize: '0.875rem' }}>
          + {t('admin.new_category')}
        </button>
      </div>

      {/* ── Charges management ── */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem' }}>{t('admin.charges')}</h2>
          <button onClick={() => setShowAddCharge(true)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>
            + {t('admin.add_charge')}
          </button>
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          {charges.length === 0 && !showAddCharge && (
            <p style={{ color: '#888', fontSize: '0.875rem' }}>{t('admin.no_charges')}</p>
          )}
          {charges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: showAddCharge ? '0.75rem' : 0 }}>
              {charges.map(ch => (
                <span key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-bg)', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                  <strong>{ch.name}</strong>
                  <span style={{ color: '#666' }}>{ch.amountDKK.toLocaleString('da-DK')} DKK</span>
                  <button onClick={() => deleteCharge(ch.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          )}
          {showAddCharge && (
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ ...labelStyle, fontSize: '0.8125rem' }}>{t('admin.charge_name')}</label>
                <input className="input-field" value={newCharge.name} onChange={e => setNewCharge(c => ({ ...c, name: e.target.value }))}
                  placeholder={t('admin.charge_name_placeholder')} style={{ minWidth: '180px' }} autoFocus />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: '0.8125rem' }}>{t('admin.charge_amount')}</label>
                <input className="input-field" type="number" min="0" value={newCharge.amountDKK}
                  onChange={e => setNewCharge(c => ({ ...c, amountDKK: e.target.value }))}
                  placeholder="0" style={{ width: '100px' }} />
              </div>
              <button onClick={addCharge} className="btn-primary" disabled={savingCharge || !newCharge.name || !newCharge.amountDKK} style={{ fontSize: '0.875rem' }}>
                {savingCharge ? t('common.loading') : t('common.save')}
              </button>
              <button onClick={() => { setShowAddCharge(false); setNewCharge({ name: '', amountDKK: '' }); }} className="btn-secondary" style={{ fontSize: '0.875rem' }}>{t('common.cancel')}</button>
            </div>
          )}
        </div>
      </section>

      {/* Room category tabs */}
      {roomCategories.length > 0 && (
        <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '2px solid #e0e0e0' }}>
          {roomCategories.map(rc => (
            <button key={rc.id} onClick={() => setActiveRoomCatId(rc.id)} style={{
              padding: '0.625rem 1.25rem', fontSize: '0.9375rem', background: 'none', border: 'none',
              cursor: 'pointer', fontWeight: activeRoomCatId === rc.id ? 600 : 400,
              color: activeRoomCatId === rc.id ? 'var(--color-primary)' : '#555',
              borderBottom: `2px solid ${activeRoomCatId === rc.id ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: '-2px',
            }}>{rc.name}</button>
          ))}
        </div>
      )}

      {visibleMainCats.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
          <p>{t('admin.no_price_categories')}</p>
          <button onClick={() => setShowWizard(true)} className="btn-primary" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            + {t('admin.new_category')}
          </button>
        </div>
      )}

      {visibleMainCats.length > 0 && (
        <>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
              className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>←</button>
            <span style={{ fontWeight: 600, fontSize: '1rem', minWidth: '160px', textAlign: 'center' }}>{monthLabel}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
              className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>→</button>
          </div>

          {/* Calendar */}
          <div style={{ overflowX: 'auto', overflowY: 'auto', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', userSelect: isDragging ? 'none' : 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '160px' }} />
                {Array.from({ length: daysInMonth }, () => <col key={Math.random()} />)}
              </colgroup>
              <thead>
                {/* Day number row */}
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', position: 'sticky', left: 0, background: 'var(--color-bg)', zIndex: 2, fontSize: '0.8125rem', color: '#666' }}>
                    {t('admin.price_categories')}
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const dow = getDayOfWeek(i + 1);
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <th key={i} style={{
                        padding: '0.25rem 0', textAlign: 'center', fontWeight: isWeekend ? 700 : 500,
                        color: WEEKDAY_COLORS[dow] ?? '#555', fontSize: '0.75rem',
                      }}>{i + 1}</th>
                    );
                  })}
                </tr>
                {/* Weekday row */}
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>
                  <th style={{ padding: '0 0.75rem 0.375rem', position: 'sticky', left: 0, background: 'var(--color-bg)', zIndex: 2 }} />
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const dow = getDayOfWeek(i + 1);
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <th key={i} style={{
                        padding: '0 0 0.375rem', textAlign: 'center',
                        fontSize: '0.625rem', fontWeight: isWeekend ? 700 : 400,
                        color: WEEKDAY_COLORS[dow] ?? '#999',
                      }}>{WEEKDAY_SHORT[dow]}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleMainCats.map(mainCat => {
                  const subs = subCatsByParent[mainCat.id] ?? [];
                  const isCollapsed = collapsed[mainCat.id];
                  return (
                    <React.Fragment key={mainCat.id}>
                      {/* ── Main category row ── */}
                      <tr style={{ backgroundColor: 'rgba(var(--color-primary-rgb,122,59,30),0.04)', borderTop: '2px solid rgba(var(--color-primary-rgb,122,59,30),0.15)' }}>
                        <td style={{
                          padding: '0.5rem 0.75rem', position: 'sticky', left: 0,
                          background: 'rgba(var(--color-primary-rgb,122,59,30),0.04)', zIndex: 1,
                          borderRight: '2px solid rgba(var(--color-primary-rgb,122,59,30),0.15)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button onClick={() => toggleCollapsed(mainCat.id)} style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.25rem',
                              fontSize: '0.875rem', color: 'var(--color-primary)', lineHeight: 1,
                            }}>{isCollapsed ? '▶' : '▼'}</button>
                            <div>
                              {renamingCatId === mainCat.id ? (
                                <input
                                  autoFocus
                                  value={renamingName}
                                  disabled={savingRename}
                                  onChange={e => setRenamingName(e.target.value)}
                                  onBlur={() => saveRename(mainCat.id)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveRename(mainCat.id); if (e.key === 'Escape') setRenamingCatId(null); }}
                                  style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: '3px', padding: '0.1rem 0.25rem', width: '130px' }}
                                />
                              ) : (
                                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-primary)' }}>
                                  {mainCat.name}
                                </div>
                              )}
                              {(() => {
                                const days = daysData[mainCat.id] ?? [];
                                if (days.length === 0) return null;
                                const parts: string[] = [];
                                const maxCancel = Math.max(...days.map(d => d.cancellationDays ?? 0));
                                if (maxCancel > 0) parts.push(`${t('admin.cancellation_short')}: ${maxCancel}d`);
                                const maxStay = Math.max(...days.map(d => d.minStayNights ?? 1));
                                if (maxStay > 1) parts.push(`${t('admin.min_stay_short')}: ${maxStay}n`);
                                const maxAdv = Math.max(...days.map(d => d.minAdvanceBookingDays ?? 0));
                                if (maxAdv > 0) parts.push(`${t('admin.min_advance_short')}: ${maxAdv}d`);
                                const noArrival = days.filter(d => !d.arrivalAllowed).length;
                                if (noArrival > 0) parts.push(`${t('admin.arrival_short')} ×${noArrival}`);
                                const noDepart = days.filter(d => !d.departureAllowed).length;
                                if (noDepart > 0) parts.push(`${t('admin.departure_short')} ×${noDepart}`);
                                if (parts.length === 0) return null;
                                return (
                                  <div style={{ fontSize: '0.7rem', color: '#888', whiteSpace: 'nowrap', marginBottom: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {parts.join(' · ')}
                                  </div>
                                );
                              })()}
                              {mainCat.charges.length > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginBottom: '0.125rem', whiteSpace: 'nowrap' }}>
                                  + {mainCat.charges.map(ch => `${ch.charge.name} (${ch.charge.amountDKK} DKK)`).join(' · ')}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.125rem' }}>
                                {subs.length > 0 && (
                                  <span style={{ fontSize: '0.7rem', color: '#888' }}>{subs.length} sub</span>
                                )}
                                <button onClick={() => startRename(mainCat)} style={{ fontSize: '0.7rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                  ✎
                                </button>
                                <button onClick={() => deleteCategory(mainCat.id)} style={{ fontSize: '0.7rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                  {t('common.delete')}
                                </button>
                                <button onClick={() => { setBulkPriceModal({ categoryId: mainCat.id, categoryName: mainCat.name }); setBulkPriceForm({ price: '', startDate: '', endDate: '', allDates: true, daysOfWeek: [] }); }} style={{ fontSize: '0.7rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                  {t('admin.set_price')}
                                </button>
                                {charges.length > 0 && (
                                  <button onClick={() => setEditChargesModal({ catId: mainCat.id, catName: mainCat.name, chargeIds: mainCat.charges.map(ch => ch.chargeId) })}
                                    style={{ fontSize: '0.7rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                    {t('admin.charges')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const day = i + 1;
                          const rec = getDayRecord(mainCat.id, day);
                          const dow = getDayOfWeek(day);
                          const isWeekend = dow === 0 || dow === 6;
                          return (
                            <CalendarCell
                              key={day}
                              rec={rec}
                              isWeekend={isWeekend}
                              isMain
                              sel={isSelected(mainCat.id, 'price', day)}
                              onClick={e => openEditDay(mainCat.id, day, e)}
                              onMouseDown={e => startDrag(mainCat.id, 'price', day, true, e)}
                              onMouseEnter={() => extendDrag(mainCat.id, 'price', day)}
                            />
                          );
                        })}
                      </tr>

                      {/* ── Sub-category rows ── */}
                      {!isCollapsed && subs.map(sub => {
                        const restrictOpen = !!restrictRowsOpen[sub.id];
                        return (
                          <React.Fragment key={sub.id}>
                            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                              <td style={{
                                padding: '0.375rem 0.5rem 0.375rem 1.75rem', position: 'sticky', left: 0,
                                background: 'var(--color-surface)', zIndex: 1,
                                borderRight: '1px solid rgba(0,0,0,0.06)',
                                overflow: 'hidden',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                                  <div style={{ width: '10px', height: '2px', backgroundColor: '#e0e0e0', flexShrink: 0, marginTop: '0.5rem' }} />
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {sub.name}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#888', whiteSpace: 'nowrap' }}>
                                      {sub.savingsPercent != null && `${sub.savingsPercent}% off`}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.125rem' }}>
                                      <button
                                        onClick={() => toggleRestrictRows(sub.id)}
                                        style={{ fontSize: '0.65rem', color: restrictOpen ? 'var(--color-primary)' : '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                                        title="Show restriction rows"
                                      >
                                        {restrictOpen ? '▼' : '▶'}
                                      </button>
                                      <button onClick={() => openRestrictionModal(sub.id)} style={{ fontSize: '0.65rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }} title="Set restrictions">
                                        ⚙
                                      </button>
                                      <button onClick={() => deleteCategory(sub.id)} style={{ fontSize: '0.65rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }} title="Delete">
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {Array.from({ length: daysInMonth }, (_, i) => {
                                const day = i + 1;
                                const rec = getDayRecord(sub.id, day);
                                const dow = getDayOfWeek(day);
                                const isWeekend = dow === 0 || dow === 6;
                                return (
                                  <CalendarCell
                                    key={day}
                                    rec={rec}
                                    isWeekend={isWeekend}
                                    isMain={false}
                                    sel={isSelected(sub.id, 'price', day)}
                                    onClick={e => openEditDay(sub.id, day, e, false)}
                                    onMouseDown={e => startDrag(sub.id, 'price', day, false, e)}
                                    onMouseEnter={() => extendDrag(sub.id, 'price', day)}
                                  />
                                );
                              })}
                            </tr>

                            {/* ── Restriction data rows ── */}
                            {restrictOpen && (
                              <>
                                {([
                                  { key: 'arrivalAllowed', short: t('admin.arrival_short'), full: t('admin.arrival_days') },
                                  { key: 'departureAllowed', short: t('admin.departure_short'), full: t('admin.departure_days') },
                                  { key: 'minStayNights', short: t('admin.min_stay_short'), full: t('admin.min_stay_nights') },
                                  { key: 'minAdvanceBookingDays', short: t('admin.min_advance_short'), full: t('admin.min_advance_booking') },
                                  { key: 'cancellationDays', short: t('admin.cancellation_short'), full: t('admin.cancellation_days') },
                                ] as const).map(({ key, short, full }) => (
                                  <tr key={key} style={{ backgroundColor: 'rgba(0,0,0,0.012)', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                                    <td title={full} style={{
                                      padding: '0.2rem 0.5rem 0.2rem 0', position: 'sticky', left: 0,
                                      background: 'rgba(0,0,0,0.012)', zIndex: 1,
                                      borderRight: '1px solid rgba(0,0,0,0.06)',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', paddingLeft: '1.75rem' }}>
                                        <div style={{ width: '2px', alignSelf: 'stretch', backgroundColor: 'rgba(var(--color-primary-rgb,122,59,30),0.18)', flexShrink: 0, borderRadius: '1px' }} />
                                        <span style={{ fontSize: '0.75rem', color: '#aaa', fontStyle: 'italic', whiteSpace: 'nowrap' }}>{short}</span>
                                      </div>
                                    </td>
                                    {Array.from({ length: daysInMonth }, (_, i) => {
                                      const day = i + 1;
                                      const rec = getDayRecord(sub.id, day);
                                      const dow = getDayOfWeek(day);
                                      const isWeekend = dow === 0 || dow === 6;
                                      let content: React.ReactNode = <span style={{ color: '#e0e0e0', fontSize: '0.55rem' }}>·</span>;
                                      if (rec) {
                                        if (key === 'arrivalAllowed') {
                                          content = <span style={{ fontSize: '0.75rem', color: rec.arrivalAllowed ? '#10b981' : '#ef4444' }}>{rec.arrivalAllowed ? '✓' : '✗'}</span>;
                                        } else if (key === 'departureAllowed') {
                                          content = <span style={{ fontSize: '0.75rem', color: rec.departureAllowed ? '#10b981' : '#ef4444' }}>{rec.departureAllowed ? '✓' : '✗'}</span>;
                                        } else if (key === 'minStayNights') {
                                          content = <span style={{ fontSize: '0.75rem', color: rec.minStayNights > 1 ? '#f59e0b' : '#ccc' }}>{rec.minStayNights}</span>;
                                        } else if (key === 'minAdvanceBookingDays') {
                                          content = <span style={{ fontSize: '0.75rem', color: rec.minAdvanceBookingDays > 0 ? '#f59e0b' : '#ccc' }}>{rec.minAdvanceBookingDays}</span>;
                                        } else if (key === 'cancellationDays') {
                                          content = <span style={{ fontSize: '0.75rem', color: rec.cancellationDays > 0 ? '#f59e0b' : '#ccc' }}>{rec.cancellationDays}</span>;
                                        }
                                      }
                                      const cellSel = isSelected(sub.id, key, day);
                                      return (
                                        <td key={day}
                                          onMouseDown={e => startDrag(sub.id, key, day, false, e)}
                                          onMouseEnter={() => extendDrag(sub.id, key, day)}
                                          onClick={e => {
                                            if (isDragging) return;
                                            if (key === 'arrivalAllowed' || key === 'departureAllowed') {
                                              e.stopPropagation();
                                              toggleBoolRestrict(sub.id, day, key);
                                            } else {
                                              openRestrictEdit(sub.id, day, key, e);
                                            }
                                          }}
                                          style={{
                                            padding: '2px 1px', textAlign: 'center', fontSize: '0.75rem',
                                            backgroundColor: cellSel ? 'rgba(59,130,246,0.18)' : isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent',
                                            outline: cellSel ? '1px solid rgba(59,130,246,0.5)' : undefined,
                                            cursor: 'pointer',
                                          }}>
                                          {content}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#aaa', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#f59e0b' }}>{t('admin.legend_custom_cell')}</span>
          </div>
        </>
      )}

      {/* ── Inline cell edit popover ── */}
      {editState && (
        <div ref={popoverRef} className="card" style={{ ...getPopoverStyle(), padding: '1rem', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
              {editState.date}
              {editState.day?.isCustom && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', backgroundColor: '#fef3c7', color: '#d97706', padding: '0.1rem 0.375rem', borderRadius: '3px' }}>custom</span>
              )}
            </span>
            <button onClick={() => setEditState(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.8125rem' }}>
                {t('admin.per_night_dkk')}
                {!editState?.isMain && <span style={{ marginLeft: '0.375rem', fontSize: '0.7rem', color: '#888' }}>({t('admin.derived_hint')})</span>}
              </label>
              <input className="input-field" type="number" min="0" value={editForm.pricePerNight}
                onChange={e => setEditForm(f => ({ ...f, pricePerNight: e.target.value }))}
                style={{ fontSize: '0.875rem' }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={editForm.arrivalAllowed} onChange={e => setEditForm(f => ({ ...f, arrivalAllowed: e.target.checked }))} />
                {t('admin.arrival_days')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={editForm.departureAllowed} onChange={e => setEditForm(f => ({ ...f, departureAllowed: e.target.checked }))} />
                {t('admin.departure_days')}
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ ...labelStyle, fontSize: '0.75rem' }}>{t('admin.min_advance_booking')}</label>
                <input className="input-field" type="number" min="0" value={editForm.minAdvanceBookingDays}
                  onChange={e => setEditForm(f => ({ ...f, minAdvanceBookingDays: e.target.value }))}
                  style={{ fontSize: '0.8125rem' }} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: '0.75rem' }}>{t('admin.min_stay_nights')}</label>
                <input className="input-field" type="number" min="1" value={editForm.minStayNights}
                  onChange={e => setEditForm(f => ({ ...f, minStayNights: e.target.value }))}
                  style={{ fontSize: '0.8125rem' }} />
              </div>
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.75rem' }}>{t('admin.cancellation_days')}</label>
              <input className="input-field" type="number" min="0" value={editForm.cancellationDays}
                onChange={e => setEditForm(f => ({ ...f, cancellationDays: e.target.value }))}
                style={{ fontSize: '0.8125rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button onClick={() => setEditState(null)} className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}>{t('common.cancel')}</button>
              <button onClick={saveEditDay} className="btn-primary" disabled={savingEdit} style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
                {savingEdit ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restriction cell focused edit popover ── */}
      {restrictEditState && (
        <div ref={restrictPopoverRef} className="card" style={{ ...getRestrictPopoverStyle(), padding: '0.875rem', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#555' }}>
              {restrictEditState.date.slice(8, 10)}/{restrictEditState.date.slice(5, 7)}
            </span>
            <button onClick={() => setRestrictEditState(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', lineHeight: 1 }}>×</button>
          </div>
          <label style={{ ...labelStyle, fontSize: '0.8125rem' }}>
            {restrictEditState.field === 'arrivalAllowed' && t('admin.arrival_days')}
            {restrictEditState.field === 'departureAllowed' && t('admin.departure_days')}
            {restrictEditState.field === 'minStayNights' && t('admin.min_stay_nights')}
            {restrictEditState.field === 'minAdvanceBookingDays' && t('admin.min_advance_booking')}
            {restrictEditState.field === 'cancellationDays' && t('admin.cancellation_days')}
          </label>
          {(restrictEditState.field === 'arrivalAllowed' || restrictEditState.field === 'departureAllowed') ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {(['true', 'false'] as const).map(v => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', padding: '0.375rem 0.75rem', border: `1.5px solid ${restrictEditValue === v ? 'var(--color-primary)' : '#e0e0e0'}`, borderRadius: '6px', flex: 1, justifyContent: 'center' }}>
                  <input type="radio" name="restrictVal" checked={restrictEditValue === v} onChange={() => setRestrictEditValue(v)} style={{ display: 'none' }} />
                  <span style={{ color: v === 'true' ? '#10b981' : '#ef4444', fontWeight: 600 }}>{v === 'true' ? t('admin.allowed') : t('admin.not_allowed')}</span>
                </label>
              ))}
            </div>
          ) : (
            <input className="input-field" type="number" min="0" value={restrictEditValue} autoFocus
              onChange={e => setRestrictEditValue(e.target.value)}
              style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }} />
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setRestrictEditState(null)} className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.3rem 0.625rem' }}>{t('common.cancel')}</button>
            <button onClick={saveRestrictEdit} className="btn-primary" disabled={savingRestrictEdit} style={{ fontSize: '0.8125rem', padding: '0.3rem 0.75rem' }}>
              {savingRestrictEdit ? '…' : t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* ── Wizard modal ── */}
      {showWizard && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.5rem' }}>
              {t('admin.new_category')} — {t('admin.step')} {wizardStep}/3
            </h3>
            {wizardError && (
              <p style={{ color: '#c0392b', fontSize: '0.875rem', padding: '0.625rem', backgroundColor: '#fdf0ef', borderRadius: '4px', marginBottom: '1rem' }}>
                {wizardError}
              </p>
            )}

            {/* Step 1: Name + type */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>{t('admin.room_categories')} *</label>
                  <select className="input-field" value={wizardForm.roomCategoryId} onChange={e => setWizardForm(f => ({ ...f, roomCategoryId: e.target.value }))}>
                    <option value="">— {t('admin.category')} —</option>
                    {roomCategories.map(rc => <option key={rc.id} value={rc.id}>{rc.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t('admin.price_categories')} Name *</label>
                  <input className="input-field" value={wizardForm.name} onChange={e => setWizardForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>{t('admin.category_type')}</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {(['main', 'sub'] as const).map(type => (
                      <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', padding: '0.625rem 1rem', border: `1.5px solid ${wizardForm.type === type ? 'var(--color-primary)' : '#e0e0e0'}`, borderRadius: '6px', flex: 1 }}>
                        <input type="radio" checked={wizardForm.type === type} onChange={() => setWizardForm(f => ({ ...f, type, copyFromId: '', copySubs: false }))} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {type === 'main' ? t('admin.main_pricing') : t('admin.sub_pricing')}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>
                            {type === 'main' ? t('admin.main_pricing_hint') : t('admin.sub_pricing_hint')}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {wizardForm.type === 'main' && (() => {
                  const mainCats = categories.filter(c => !c.parentId);
                  if (mainCats.length === 0) return null;
                  return (
                    <>
                      <div>
                        <label style={labelStyle}>{t('admin.copy_from_category')} <span style={{ color: '#aaa', fontWeight: 400 }}>{t('admin.optional')}</span></label>
                        <select className="input-field" value={wizardForm.copyFromId}
                          onChange={async e => {
                            const srcId = e.target.value;
                            const src = categories.find(c => c.id === srcId);
                            const update: Partial<typeof wizardForm> = {
                              copyFromId: srcId,
                              copySubs: false,
                              copyCustomFields: false,
                              ...(src ? {
                                chargeIds: src.charges.map((ch: any) => ch.chargeId),
                              } : {}),
                            };
                            if (srcId) {
                              try {
                                const daysRes = await apiClient.get<any[]>(`/price-categories/${srcId}/days`);
                                const dates = daysRes.data.map((d: any) => d.date.slice(0, 10)).sort();
                                if (dates.length > 0) {
                                  // Days represent nights, so the last stored date is checkOut - 1 day.
                                  // Add 1 day so the wizard endDate matches the actual checkout date.
                                  const lastNight = new Date(dates[dates.length - 1] + 'T00:00:00Z');
                                  lastNight.setUTCDate(lastNight.getUTCDate() + 1);
                                  update.startDate = dates[0];
                                  update.endDate = lastNight.toISOString().slice(0, 10);
                                }
                              } catch {}
                            }
                            setWizardForm(f => ({ ...f, ...update }));
                          }}>
                          <option value="">{t('admin.no_copy')}</option>
                          {mainCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      {wizardForm.copyFromId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={wizardForm.copySubs}
                              onChange={e => setWizardForm(f => ({ ...f, copySubs: e.target.checked }))} />
                            {t('admin.copy_also_subs')}
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                            <input type="checkbox" checked={wizardForm.copyCustomFields}
                              onChange={e => setWizardForm(f => ({ ...f, copyCustomFields: e.target.checked }))} />
                            {t('admin.copy_custom_fields')}
                          </label>
                          {wizardForm.copyCustomFields && (
                            <p style={{ fontSize: '0.75rem', color: '#b45309', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '0.375rem 0.625rem', margin: 0 }}>
                              {t('admin.copy_prices_warning')}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button onClick={cancelWizard} className="btn-secondary">{t('common.cancel')}</button>
                  <button onClick={() => setWizardStep(wizardForm.type === 'sub' ? 2 : 3)} className="btn-primary" disabled={!wizardForm.name || !wizardForm.roomCategoryId}>
                    {t('booking.continue')} →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Sub-category settings */}
            {wizardStep === 2 && wizardForm.type === 'sub' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>{t('admin.parent_category')} *</label>
                  <select className="input-field" value={wizardForm.parentId} onChange={e => setWizardForm(f => ({ ...f, parentId: e.target.value }))}>
                    <option value="">— {t('admin.no_category')} —</option>
                    {categories.filter(c => c.roomCategoryId === wizardForm.roomCategoryId && !c.parentId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t('admin.savings_percent')} (%) *</label>
                  <input className="input-field" type="number" min="0" max="100" step="0.5"
                    value={wizardForm.savingsPercent}
                    onChange={e => setWizardForm(f => ({ ...f, savingsPercent: e.target.value }))}
                    placeholder="10" />
                  <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                    {t('admin.sub_pricing_hint')}
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <button onClick={() => setWizardStep(1)} className="btn-secondary">←</button>
                  <button onClick={() => setWizardStep(3)} className="btn-primary" disabled={!wizardForm.parentId || !wizardForm.savingsPercent}>
                    {t('booking.continue')} →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Date range + price (main only) */}
            {wizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {wizardForm.type === 'sub' ? (
                  <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16,185,129,0.06)', borderRadius: '6px', fontSize: '0.875rem', color: '#065f46' }}>
                    {t('admin.sub_derived_info', { percent: wizardForm.savingsPercent })}
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={labelStyle}>{t('admin.per_night_dkk')} *</label>
                      <input className="input-field" type="number" min="0" value={wizardForm.pricePerNight} onChange={e => setWizardForm(f => ({ ...f, pricePerNight: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>{t('admin.cancellation_days')}</label>
                      <input className="input-field" type="number" min="0" value={wizardForm.defaultCancellationDays}
                        onChange={e => setWizardForm(f => ({ ...f, defaultCancellationDays: e.target.value }))} />
                    </div>
                    {charges.length > 0 && (
                      <div>
                        <label style={labelStyle}>{t('admin.attach_charges')}</label>
                        <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>{t('admin.select_charges')}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          {charges.map(ch => (
                            <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem' }}>
                              <input
                                type="checkbox"
                                checked={wizardForm.chargeIds.includes(ch.id)}
                                onChange={e => setWizardForm(f => ({
                                  ...f,
                                  chargeIds: e.target.checked
                                    ? [...f.chargeIds, ch.id]
                                    : f.chargeIds.filter(id => id !== ch.id),
                                }))}
                              />
                              {ch.name} — <strong>{ch.amountDKK.toLocaleString('da-DK')} DKK</strong>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {wizardForm.parentId && (
                  <button type="button" className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', alignSelf: 'flex-start' }}
                    onClick={async () => {
                      try {
                        const res = await apiClient.get<PriceCategoryDay[]>(`/price-categories/${wizardForm.parentId}/days`);
                        const dates = res.data.map(d => d.date.slice(0, 10)).sort();
                        if (dates.length > 0) setWizardForm(f => ({ ...f, startDate: dates[0], endDate: dates[dates.length - 1] }));
                      } catch {}
                    }}>
                    {t('admin.inherit_from_parent')}
                  </button>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>{t('admin.from')} *</label>
                    <input className="input-field" type="date" value={wizardForm.startDate} onChange={e => setWizardForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('admin.to_date')} *</label>
                    <input className="input-field" type="date" value={wizardForm.endDate} onChange={e => setWizardForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                {/* Date presets */}
                {(() => {
                  const thisYear = new Date().getFullYear();
                  const presetYears = [thisYear, thisYear + 1, thisYear + 2];
                  return (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.375rem' }}>{t('admin.quick_select')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {presetYears.map(y => (
                          <button key={y} type="button" className="btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                            onClick={() => setWizardForm(f => ({ ...f, startDate: `${y}-01-01`, endDate: `${y}-12-31` }))}>
                            {y}
                          </button>
                        ))}
                        {[3, 6, 9, 12].map(months => {
                          const start = new Date();
                          start.setDate(1);
                          const end = new Date(start);
                          end.setMonth(end.getMonth() + months);
                          end.setDate(0);
                          const s = start.toISOString().slice(0, 10);
                          const e2 = end.toISOString().slice(0, 10);
                          return (
                            <button key={months} type="button" className="btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                              onClick={() => setWizardForm(f => ({ ...f, startDate: s, endDate: e2 }))}>
                              {t('admin.months_short', { count: months })}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <button onClick={() => setWizardStep(wizardForm.type === 'sub' ? 2 : 1)} className="btn-secondary">←</button>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={cancelWizard} className="btn-secondary">{t('common.cancel')}</button>
                    <button
                      onClick={runWizard}
                      className="btn-primary"
                      disabled={savingWizard || !wizardForm.startDate || !wizardForm.endDate || (wizardForm.type === 'main' && !wizardForm.pricePerNight)}
                    >
                      {savingWizard ? t('common.loading') : t('common.save')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit charges modal ── */}
      {editChargesModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
              {t('admin.attach_charges')}
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.25rem' }}>{editChargesModal.catName}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {charges.map(ch => (
                <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.9375rem' }}>
                  <input
                    type="checkbox"
                    checked={editChargesModal.chargeIds.includes(ch.id)}
                    onChange={e => setEditChargesModal(m => m ? ({
                      ...m,
                      chargeIds: e.target.checked
                        ? [...m.chargeIds, ch.id]
                        : m.chargeIds.filter(id => id !== ch.id),
                    }) : null)}
                  />
                  <span>{ch.name}</span>
                  <span style={{ color: '#888', marginLeft: 'auto' }}>{ch.amountDKK.toLocaleString('da-DK')} DKK</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditChargesModal(null)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={saveEditCharges} className="btn-primary" disabled={savingEditCharges}>
                {savingEditCharges ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restriction modal ── */}
      {showRestriction && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.25rem' }}>
              {t('admin.restriction_tool')} — {categories.find(c => c.id === restrictForm.categoryId)?.name}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>{t('admin.from')}</label>
                  <input className="input-field" type="date" value={restrictForm.startDate} onChange={e => setRestrictForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>{t('admin.to_date')}</label>
                  <input className="input-field" type="date" value={restrictForm.endDate} onChange={e => setRestrictForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              {parentAllDays.length > 0 && (() => {
                const dates = parentAllDays.map(d => d.date.slice(0, 10)).sort();
                return (
                  <button type="button" className="btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', alignSelf: 'flex-start' }}
                    onClick={() => setRestrictForm(f => ({ ...f, startDate: dates[0], endDate: dates[dates.length - 1] }))}>
                    {t('admin.inherit_from_parent')} ({dates[0]} → {dates[dates.length - 1]})
                  </button>
                );
              })()}
              <div>
                <label style={labelStyle}>{t('admin.days_of_week')}</label>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {WEEKDAY_ORDER.map(i => {
                    const sel = restrictForm.daysOfWeek.includes(i);
                    return (
                      <button key={i} type="button"
                        onClick={() => setRestrictForm(f => ({ ...f, daysOfWeek: sel ? f.daysOfWeek.filter(x => x !== i) : [...f.daysOfWeek, i] }))}
                        style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1.5px solid', borderColor: sel ? 'var(--color-primary)' : '#e0e0e0', background: sel ? 'var(--color-primary)' : 'white', color: sel ? 'white' : '#555', cursor: 'pointer', fontSize: '0.75rem' }}>{WEEKDAY_SHORT[i]}</button>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '0.25rem' }}>{t('admin.days_of_week_hint')}</p>
              </div>
              <div>
                <label style={labelStyle}>{t('admin.apply_restriction')} *</label>
                <select className="input-field" value={restrictForm.field} onChange={e => setRestrictForm(f => ({ ...f, field: e.target.value as any, value: '' }))}>
                  <option value="arrivalAllowed">{t('admin.arrival_days')}</option>
                  <option value="departureAllowed">{t('admin.departure_days')}</option>
                  <option value="minAdvanceBookingDays">{t('admin.min_advance_booking')}</option>
                  <option value="minStayNights">{t('admin.min_stay_nights')}</option>
                  <option value="cancellationDays">{t('admin.cancellation_days')}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('admin.value')} *</label>
                {['arrivalAllowed', 'departureAllowed'].includes(restrictForm.field) ? (
                  <select className="input-field" value={restrictForm.value} onChange={e => setRestrictForm(f => ({ ...f, value: e.target.value }))}>
                    <option value="">—</option>
                    <option value="true">{t('admin.allowed')}</option>
                    <option value="false">{t('admin.not_allowed')}</option>
                  </select>
                ) : (
                  <input className="input-field" type="number" min="0" value={restrictForm.value} onChange={e => setRestrictForm(f => ({ ...f, value: e.target.value }))} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowRestriction(false)} className="btn-secondary">{t('common.cancel')}</button>
                <button onClick={applyRestriction} className="btn-primary"
                  disabled={savingRestrict || !restrictForm.startDate || !restrictForm.endDate || !restrictForm.value}>
                  {savingRestrict ? t('common.loading') : t('admin.apply_restriction')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk price modal ── */}
      {bulkPriceModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.25rem' }}>
              {t('admin.set_price')} — {bulkPriceModal.categoryName}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>{t('admin.per_night_dkk')} *</label>
                <input className="input-field" type="number" min="0" value={bulkPriceForm.price}
                  onChange={e => setBulkPriceForm(f => ({ ...f, price: e.target.value }))}
                  autoFocus />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={bulkPriceForm.allDates}
                    onChange={e => setBulkPriceForm(f => ({ ...f, allDates: e.target.checked }))} />
                  {t('admin.apply_to_all_dates')}
                </label>
              </div>
              {!bulkPriceForm.allDates && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>{t('admin.from')} *</label>
                    <input className="input-field" type="date" value={bulkPriceForm.startDate}
                      onChange={e => setBulkPriceForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('admin.to_date')} *</label>
                    <input className="input-field" type="date" value={bulkPriceForm.endDate}
                      onChange={e => setBulkPriceForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>{t('admin.days_of_week')}</label>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {WEEKDAY_ORDER.map(i => {
                    const sel = bulkPriceForm.daysOfWeek.includes(i);
                    return (
                      <button key={i} type="button"
                        onClick={() => setBulkPriceForm(f => ({
                          ...f,
                          daysOfWeek: sel ? f.daysOfWeek.filter(x => x !== i) : [...f.daysOfWeek, i],
                        }))}
                        style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1.5px solid', borderColor: sel ? 'var(--color-primary)' : '#e0e0e0', background: sel ? 'var(--color-primary)' : 'white', color: sel ? 'white' : '#555', cursor: 'pointer', fontSize: '0.75rem' }}>{WEEKDAY_SHORT[i]}</button>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.25rem' }}>{t('admin.days_of_week_hint')}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setBulkPriceModal(null)} className="btn-secondary">{t('common.cancel')}</button>
                <button onClick={saveBulkPrice} className="btn-primary"
                  disabled={savingBulk || !bulkPriceForm.price || (!bulkPriceForm.allDates && (!bulkPriceForm.startDate || !bulkPriceForm.endDate))}>
                  {savingBulk ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Range edit modal ── */}
      {rangeEdit && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem', width: '100%', maxWidth: '360px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  {rangeEdit.days.length} {rangeEdit.days.length === 1 ? t('admin.nights').replace(/s$/, '') : t('admin.nights')}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#888' }}>
                  {new Date(calYear, calMonth, rangeEdit.days[0]).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                  {' – '}
                  {new Date(calYear, calMonth, rangeEdit.days[rangeEdit.days.length - 1]).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button onClick={() => setRangeEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
            </div>

            <label style={{ ...labelStyle, fontSize: '0.875rem' }}>
              {rangeEdit.rowKey === 'price' && t('admin.per_night_dkk')}
              {rangeEdit.rowKey === 'arrivalAllowed' && t('admin.arrival_days')}
              {rangeEdit.rowKey === 'departureAllowed' && t('admin.departure_days')}
              {rangeEdit.rowKey === 'minStayNights' && t('admin.min_stay_nights')}
              {rangeEdit.rowKey === 'minAdvanceBookingDays' && t('admin.min_advance_booking')}
              {rangeEdit.rowKey === 'cancellationDays' && t('admin.cancellation_days')}
            </label>

            {(rangeEdit.rowKey === 'arrivalAllowed' || rangeEdit.rowKey === 'departureAllowed') ? (
              <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1.25rem' }}>
                {(['true', 'false'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.9375rem', padding: '0.5rem 1rem', border: `1.5px solid ${rangeEditValue === v ? 'var(--color-primary)' : '#e0e0e0'}`, borderRadius: '6px', flex: 1, justifyContent: 'center' }}>
                    <input type="radio" name="rangeVal" checked={rangeEditValue === v} onChange={() => setRangeEditValue(v)} style={{ display: 'none' }} />
                    <span style={{ color: v === 'true' ? '#10b981' : '#ef4444', fontWeight: 600 }}>{v === 'true' ? t('admin.allowed') : t('admin.not_allowed')}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input className="input-field" type="number" min="0" value={rangeEditValue} autoFocus
                onChange={e => setRangeEditValue(e.target.value)}
                style={{ fontSize: '1rem', marginBottom: '1.25rem' }} />
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setRangeEdit(null)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={saveRangeEdit} className="btn-primary" disabled={savingRangeEdit}>
                {savingRangeEdit ? t('common.loading') : `${t('common.save')} (${rangeEdit.days.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      </>}

    </AdminLayout>
  );
}

// ── CalendarCell ─────────────────────────────────────────────────────────────

interface CalendarCellProps {
  rec: PriceCategoryDay | undefined;
  isWeekend: boolean;
  isMain: boolean;
  sel: boolean;
  onClick: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onMouseEnter: () => void;
}

function CalendarCell({ rec, isWeekend, isMain, sel, onClick, onMouseDown, onMouseEnter }: CalendarCellProps) {
  const bg = sel
    ? 'rgba(59,130,246,0.18)'
    : rec?.isCustom
      ? 'rgba(245,158,11,0.12)'
      : isMain
        ? isWeekend ? 'rgba(var(--color-primary-rgb,122,59,30),0.05)' : 'transparent'
        : isWeekend ? 'rgba(0,0,0,0.03)' : 'transparent';

  return (
    <td
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      title={rec ? `${rec.pricePerNight} DKK${rec.isCustom ? ' (custom)' : ''}` : 'No data — click to set'}
      style={{
        padding: '2px 1px', textAlign: 'center', cursor: 'pointer',
        backgroundColor: bg, verticalAlign: 'middle',
        borderLeft: isWeekend ? '1px solid rgba(0,0,0,0.08)' : undefined,
        transition: 'background 0.1s',
        outline: sel ? '1px solid rgba(59,130,246,0.5)' : undefined,
      }}
    >
      {rec ? (
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: isMain ? 600 : 400, fontSize: '0.75rem', color: rec.isCustom ? '#b45309' : isMain ? 'var(--color-text)' : '#555' }}>
            {Math.round(rec.pricePerNight)}
          </div>
        </div>
      ) : (
        <div style={{ color: '#e0e0e0', fontSize: '0.625rem' }}>·</div>
      )}
    </td>
  );
}
