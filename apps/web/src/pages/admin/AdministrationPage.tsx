import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from './AdminLayout';
import { BookingCalendar } from './components/BookingCalendar';
import { useConfirm } from '../../components/ConfirmDialog';
import { apiClient } from '../../hooks/useApi';
import type { Room, Booking, BookingRoom, CalendarSource, RoomCategory } from '@dagmar/shared';

type RoomForm = {
  name: string;
  description: string;
  maxGuests: string;
  amenities: string;
  categoryIds: string[];
};

const emptyForm: RoomForm = {
  name: '', description: '', maxGuests: '2', amenities: '', categoryIds: [],
};

function toSlug(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const statusColors: Record<string, string> = {
  PENDING: '#f59e0b', CONFIRMED: '#10b981', CHECKED_IN: '#3b82f6',
  CHECKED_OUT: '#6b7280', CANCELLED: '#ef4444', CUSTOMER_CANCELLED: '#f97316', NO_SHOW: '#9ca3af',
};

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500,
};

interface AdminBookingRoomEntry {
  roomCategoryId: string;
  count: number;
  pricePerNight: string;
}

export default function AdministrationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);

  // QR modal
  const [qrModal, setQrModal] = React.useState<{ roomId: string; name: string; qrDataUrl: string } | null>(null);

  // Room modal
  const [roomModal, setRoomModal] = React.useState<{ mode: 'add' | 'edit'; room?: Room } | null>(null);
  const [form, setForm] = React.useState<RoomForm>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  // Booking mode + times
  const [bookingMode, setBookingMode] = React.useState<'manual' | 'autonomous'>('manual');
  const [selectedMode, setSelectedMode] = React.useState<'manual' | 'autonomous'>('manual');
  const [savingMode, setSavingMode] = React.useState(false);
  const [arrivalTime, setArrivalTime] = React.useState('16:00');
  const [departureTime, setDepartureTime] = React.useState('10:00');
  const [editArrival, setEditArrival] = React.useState('16:00');
  const [editDeparture, setEditDeparture] = React.useState('10:00');
  const [savingTimes, setSavingTimes] = React.useState(false);

  // Calendar sources
  const [calendarSources, setCalendarSources] = React.useState<CalendarSource[]>([]);
  const [sourceModal, setSourceModal] = React.useState<{ mode: 'add' | 'edit'; source?: CalendarSource } | null>(null);
  const [sourceForm, setSourceForm] = React.useState({ name: '', feedUrl: '', roomIds: [] as string[] });
  const [savingSource, setSavingSource] = React.useState(false);
  const [syncingSource, setSyncingSource] = React.useState<string | null>(null);
  const [syncResult, setSyncResult] = React.useState<Record<string, { added: number; updated: number }>>({});

  // Room categories
  const [categories, setCategories] = React.useState<RoomCategory[]>([]);
  const [addingCategory, setAddingCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [savingCategory, setSavingCategory] = React.useState(false);

  // Block period modal (legacy per-room)
  const [blockPeriodModal, setBlockPeriodModal] = React.useState<{ room: Room } | null>(null);
  const [blockPeriodForm, setBlockPeriodForm] = React.useState({ startDate: '', endDate: '', reason: '', categoryIds: [] as string[] });
  const [savingBlockPeriod, setSavingBlockPeriod] = React.useState(false);
  const [closedPeriods, setClosedPeriods] = React.useState<Record<string, Array<{ id: string; startDate: string; endDate: string; reason?: string; roomCategoryIds: string[] }>>>({});

  const LANGS = [
    { code: 'da', label: 'Dansk' },
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'nl', label: 'Nederlands' },
    { code: 'it', label: 'Italiano' },
  ];

  // House rules
  interface HouseRule { id: string; text: string; sortOrder: number; translations?: Record<string, string> }
  const [houseRules, setHouseRules] = React.useState<HouseRule[]>([]);
  const [showHouseRuleAdd, setShowHouseRuleAdd] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<HouseRule | null>(null);
  const [ruleForm, setRuleForm] = React.useState({ text: '' });
  const [savingRule, setSavingRule] = React.useState(false);
  const [dragOverRuleId, setDragOverRuleId] = React.useState<string | null>(null);

  // Translation editing (shared for categories and house rules)
  const [translatingId, setTranslatingId] = React.useState<string | null>(null);
  const [transForm, setTransForm] = React.useState<Record<string, string>>({});
  const [savingTrans, setSavingTrans] = React.useState(false);

  // Subtab
  const [activeSubTab, setActiveSubTab] = React.useState<'booking' | 'rooms' | 'general'>('booking');

  // Calendar navigation
  const calendarRef = React.useRef<HTMLDivElement>(null);
  const [calendarTargetDate, setCalendarTargetDate] = React.useState<Date | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = React.useState<string | null>(null);

  // Admin booking modal
  const [showAdminBooking, setShowAdminBooking] = React.useState(false);
  const [adminBookingForm, setAdminBookingForm] = React.useState({
    guestName: '', guestEmail: '', guestPhone: '', checkIn: '', checkOut: '', notes: '',
    status: 'CONFIRMED' as Booking['status'],
  });
  const [adminBookingRooms, setAdminBookingRooms] = React.useState<AdminBookingRoomEntry[]>([]);
  const [savingAdminBooking, setSavingAdminBooking] = React.useState(false);
  const [adminBookingError, setAdminBookingError] = React.useState('');
  const [adminAvailability, setAdminAvailability] = React.useState<Record<string, number>>({});

  const loadData = async () => {
    try {
      const [roomsRes, bookingsRes, settingsRes, sourcesRes, catsRes, hrRes] = await Promise.all([
        apiClient.get<Room[]>('/rooms/all'),
        apiClient.get<Booking[]>('/bookings'),
        apiClient.get<{ bookingMode: 'manual' | 'autonomous'; arrivalTime: string; departureTime: string }>('/settings'),
        apiClient.get<CalendarSource[]>('/ical/calendar-sources'),
        apiClient.get<RoomCategory[]>('/room-categories'),
        apiClient.get<any[]>('/house-rules').catch(() => ({ data: [] })),
      ]);
      setRooms(roomsRes.data);
      setBookings(bookingsRes.data);
      setBookingMode(settingsRes.data.bookingMode);
      setSelectedMode(settingsRes.data.bookingMode);
      setArrivalTime(settingsRes.data.arrivalTime ?? '16:00');
      setDepartureTime(settingsRes.data.departureTime ?? '10:00');
      setEditArrival(settingsRes.data.arrivalTime ?? '16:00');
      setEditDeparture(settingsRes.data.departureTime ?? '10:00');
      setCalendarSources(sourcesRes.data);
      setCategories(catsRes.data);
      setHouseRules(hrRes.data);

      // Load closed periods for all rooms
      const periodEntries = await Promise.all(
        roomsRes.data.map(room =>
          apiClient.get<Array<{ id: string; startDate: string; endDate: string; reason?: string }>>(`/rooms/${room.id}/closed-periods`)
            .then(res => [room.id, res.data] as const)
            .catch(() => [room.id, []] as const)
        )
      );
      setClosedPeriods(Object.fromEntries(periodEntries));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadData(); }, []);

  // Booking mode
  const saveBookingMode = async () => {
    setSavingMode(true);
    try {
      await apiClient.patch('/settings', { bookingMode: selectedMode });
      setBookingMode(selectedMode);
    } finally {
      setSavingMode(false);
    }
  };

  const saveCheckInTimes = async () => {
    setSavingTimes(true);
    try {
      await apiClient.patch('/settings', { arrivalTime: editArrival, departureTime: editDeparture });
      setArrivalTime(editArrival);
      setDepartureTime(editDeparture);
    } finally {
      setSavingTimes(false);
    }
  };

  // Room categories
  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await apiClient.post('/room-categories', { name: newCategoryName.trim() });
      setNewCategoryName('');
      setAddingCategory(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!await confirm({ title: t('common.confirm_delete'), message: t('common.cannot_undo'), variant: 'danger' })) return;
    await apiClient.delete(`/room-categories/${id}`);
    loadData();
  };

  const openTranslations = (id: string, existing?: Record<string, string>) => {
    setTranslatingId(id);
    const form: Record<string, string> = {};
    for (const { code } of LANGS) form[code] = existing?.[code] ?? '';
    setTransForm(form);
  };

  const saveTranslations = async (endpoint: string) => {
    setSavingTrans(true);
    try {
      await apiClient.patch(endpoint, { translations: transForm });
      setTranslatingId(null);
      loadData();
    } finally {
      setSavingTrans(false);
    }
  };

  const GlobeIcon = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <ellipse cx="8" cy="8" rx="2.8" ry="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="1.5" y1="10.5" x2="14.5" y2="10.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );

  // Rooms
  const openAdd = () => { setForm(emptyForm); setFormError(''); setRoomModal({ mode: 'add' }); };
  const openEdit = (room: Room) => {
    setForm({
      name: room.name, description: room.description,
      maxGuests: room.maxGuests.toString(),
      amenities: room.amenities.join(', '),
      categoryIds: room.roomCategories.map(rc => rc.roomCategoryId),
    });
    setFormError('');
    setRoomModal({ mode: 'edit', room });
  };

  const saveRoom = async () => {
    setSaving(true); setFormError('');
    const name = form.name.trim();
    const basePayload = {
      name, description: form.description.trim(),
      maxGuests: parseInt(form.maxGuests),
      amenities: form.amenities.split(',').map(a => a.trim()).filter(Boolean),
      categoryIds: form.categoryIds,
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

  const openBlockPeriod = async (room: Room) => {
    setBlockPeriodForm({ startDate: '', endDate: '', reason: '', categoryIds: [] });
    setBlockPeriodModal({ room });
    try {
      const res = await apiClient.get<Array<{ id: string; startDate: string; endDate: string; reason?: string; roomCategoryIds: string[] }>>(`/rooms/${room.id}/closed-periods`);
      setClosedPeriods(prev => ({ ...prev, [room.id]: res.data }));
    } catch {}
  };

  const saveBlockPeriod = async () => {
    if (!blockPeriodModal || !blockPeriodForm.startDate || !blockPeriodForm.endDate) return;
    setSavingBlockPeriod(true);
    try {
      await apiClient.post(`/rooms/${blockPeriodModal.room.id}/closed-periods`, {
        startDate: blockPeriodForm.startDate,
        endDate: blockPeriodForm.endDate,
        reason: blockPeriodForm.reason || undefined,
        roomCategoryIds: blockPeriodForm.categoryIds,
      });
      const res = await apiClient.get<Array<{ id: string; startDate: string; endDate: string; reason?: string; roomCategoryIds: string[] }>>(`/rooms/${blockPeriodModal.room.id}/closed-periods`);
      setClosedPeriods(prev => ({ ...prev, [blockPeriodModal.room.id]: res.data }));
      setBlockPeriodForm({ startDate: '', endDate: '', reason: '', categoryIds: [] });
    } finally {
      setSavingBlockPeriod(false);
    }
  };

  const deleteBlockPeriod = async (roomId: string, periodId: string) => {
    await apiClient.delete(`/rooms/${roomId}/closed-periods/${periodId}`);
    setClosedPeriods(prev => ({ ...prev, [roomId]: (prev[roomId] ?? []).filter(p => p.id !== periodId) }));
  };

  const showQR = async (roomId: string, name: string) => {
    const res = await apiClient.get<{ qrDataUrl: string }>(`/rooms/${roomId}/qr`);
    setQrModal({ roomId, name, qrDataUrl: res.data.qrDataUrl });
  };

  // Bookings
  const updateBookingStatus = async (id: string, status: string) => {
    await apiClient.patch(`/bookings/${id}/status`, { status });
    loadData();
  };

  const checkAssignmentConflict = async (bookingId: string, roomId: string): Promise<boolean> => {
    try {
      const res = await apiClient.get<{ conflicts: Array<{ bookingRef: string; guestName: string; categoryName: string }> }>(
        `/bookings/${bookingId}/assignment-conflict?roomId=${roomId}`
      );
      if (res.data.conflicts.length > 0) {
        const names = res.data.conflicts.map(c => `${c.bookingRef} (${c.guestName})`).join(', ');
        return confirm({
          title: t('admin.room_assignment_conflict_title'),
          message: t('admin.room_assignment_conflict_warning', { bookings: names }),
          variant: 'warning',
        });
      }
    } catch {}
    return true;
  };

  const assignBookingRoom = async (bookingId: string, bookingRoomId: string, roomId: string | null) => {
    if (roomId && !(await checkAssignmentConflict(bookingId, roomId))) return;
    await apiClient.patch(`/bookings/${bookingId}/assign`, { bookingRoomId, roomId });
    loadData();
  };

  const assignLegacy = async (bookingId: string, roomId: string | null) => {
    if (roomId && !(await checkAssignmentConflict(bookingId, roomId))) return;
    await apiClient.patch(`/bookings/${bookingId}/assign`, { roomId });
    loadData();
  };

  const navigateToBooking = (booking: Booking) => {
    setCalendarTargetDate(new Date(booking.checkIn));
    setHighlightedBookingId(booking.id);
    calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Calendar sources
  const openAddSource = () => {
    setSourceForm({ name: '', feedUrl: '', roomIds: [] });
    setSourceModal({ mode: 'add' });
  };

  const openEditSource = (source: CalendarSource) => {
    setSourceForm({
      name: source.name,
      feedUrl: source.feedUrl,
      roomIds: source.rooms.map(r => r.roomId),
    });
    setSourceModal({ mode: 'edit', source });
  };

  const saveSource = async () => {
    setSavingSource(true);
    try {
      if (sourceModal?.mode === 'add') {
        await apiClient.post('/ical/calendar-sources', sourceForm);
      } else if (sourceModal?.source) {
        await apiClient.patch(`/ical/calendar-sources/${sourceModal.source.id}`, sourceForm);
      }
      setSourceModal(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingSource(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!await confirm({ title: t('common.confirm_delete'), message: t('common.cannot_undo'), variant: 'danger' })) return;
    await apiClient.delete(`/ical/calendar-sources/${id}`);
    loadData();
  };

  const syncSource = async (id: string) => {
    setSyncingSource(id);
    try {
      const res = await apiClient.post<{ added: number; updated: number }>(`/ical/calendar-sources/${id}/sync`);
      setSyncResult(prev => ({ ...prev, [id]: res.data }));
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSyncingSource(null);
    }
  };

  const copyExportUrl = (roomId: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const url = `${apiUrl}/api/v1/ical/rooms/${roomId}/calendar.ics`;
    navigator.clipboard.writeText(url).then(() => alert('✓'));
  };

  // House rules
  const openAddRule = () => { setRuleForm({ text: '' }); setEditingRule(null); setShowHouseRuleAdd(true); };
  const openEditRule = (rule: HouseRule) => { setRuleForm({ text: rule.text }); setEditingRule(rule); setShowHouseRuleAdd(true); };

  const saveHouseRule = async () => {
    if (!ruleForm.text.trim()) return;
    setSavingRule(true);
    try {
      if (editingRule) {
        await apiClient.patch(`/house-rules/${editingRule.id}`, { text: ruleForm.text.trim() });
      } else {
        await apiClient.post('/house-rules', { text: ruleForm.text.trim() });
      }
      setShowHouseRuleAdd(false);
      setEditingRule(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingRule(false);
    }
  };

  const deleteHouseRule = async (id: string) => {
    if (!await confirm({ title: t('common.confirm_delete'), message: t('common.cannot_undo'), variant: 'danger' })) return;
    await apiClient.delete(`/house-rules/${id}`);
    loadData();
  };

  const dragRuleId = React.useRef<string | null>(null);

  const handleRuleDragStart = (id: string) => { dragRuleId.current = id; };
  const handleRuleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverRuleId(id); };
  const handleRuleDrop = async (targetId: string) => {
    setDragOverRuleId(null);
    const fromId = dragRuleId.current;
    if (!fromId || fromId === targetId) return;
    const fromIdx = houseRules.findIndex(r => r.id === fromId);
    const toIdx = houseRules.findIndex(r => r.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...houseRules];
    const [item] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, item);
    setHouseRules(reordered);
    try {
      await apiClient.post('/house-rules/reorder', { ids: reordered.map(r => r.id) });
    } catch {
      loadData(); // revert on error
    }
  };

  // Admin booking
  const adminBookingNights = React.useMemo(() => {
    if (!adminBookingForm.checkIn || !adminBookingForm.checkOut) return 0;
    return Math.max(0, Math.ceil(
      (new Date(adminBookingForm.checkOut).getTime() - new Date(adminBookingForm.checkIn).getTime()) / 86400000
    ));
  }, [adminBookingForm.checkIn, adminBookingForm.checkOut]);

  const adminBookingTotal = React.useMemo(() => {
    return adminBookingRooms.reduce((sum, r) => sum + (parseFloat(r.pricePerNight) || 0) * r.count * adminBookingNights, 0);
  }, [adminBookingRooms, adminBookingNights]);

  // Load availability when dates change
  React.useEffect(() => {
    if (!adminBookingForm.checkIn || !adminBookingForm.checkOut || !showAdminBooking) return;
    apiClient.get<{ categories: { roomCategoryId: string; availableCount: number }[] }>(
      `/availability/rates?checkIn=${adminBookingForm.checkIn}&checkOut=${adminBookingForm.checkOut}`
    ).then(res => {
      const map: Record<string, number> = {};
      res.data.categories.forEach(c => { map[c.roomCategoryId] = c.availableCount; });
      setAdminAvailability(map);
      // Reset counts that exceed new availability
      setAdminBookingRooms(prev => prev.map(r => ({
        ...r,
        count: Math.min(r.count, map[r.roomCategoryId] ?? 0),
      })).filter(r => r.count > 0));
    }).catch(() => {});
  }, [adminBookingForm.checkIn, adminBookingForm.checkOut, showAdminBooking]);

  const addAdminRoom = (roomCategoryId: string) => {
    if (!adminBookingRooms.find(r => r.roomCategoryId === roomCategoryId)) {
      setAdminBookingRooms(prev => [...prev, { roomCategoryId, count: 1, pricePerNight: '' }]);
    }
  };

  const removeAdminRoom = (roomCategoryId: string) => {
    setAdminBookingRooms(prev => prev.filter(r => r.roomCategoryId !== roomCategoryId));
  };

  const saveAdminBooking = async () => {
    setSavingAdminBooking(true);
    setAdminBookingError('');
    try {
      await apiClient.post('/bookings/admin', {
        ...adminBookingForm,
        rooms: adminBookingRooms.map(r => ({
          roomCategoryId: r.roomCategoryId,
          count: r.count,
          pricePerNight: parseFloat(r.pricePerNight) || 0,
        })),
      });
      setShowAdminBooking(false);
      setAdminBookingForm({ guestName: '', guestEmail: '', guestPhone: '', checkIn: '', checkOut: '', notes: '', status: 'CONFIRMED' });
      setAdminBookingRooms([]);
      loadData();
    } catch (err: any) {
      const data = err.response?.data;
      const detail = data?.details?.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ');
      setAdminBookingError(detail || data?.error || t('common.error'));
    } finally {
      setSavingAdminBooking(false);
    }
  };

  if (loading) return <AdminLayout><div style={{ padding: '4rem', textAlign: 'center' }}>{t('common.loading')}</div></AdminLayout>;

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  return (
    <AdminLayout>
      {dialog}
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', marginBottom: '1.5rem' }}>
        {t('admin.administration')}
      </h1>

      {/* ── Subtabs ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
        {([
          { key: 'booking', label: t('admin.tab_bookings') },
          { key: 'rooms',   label: t('admin.tab_rooms') },
          { key: 'general', label: t('admin.tab_general') },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeSubTab === tab.key ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: '-2px',
              color: activeSubTab === tab.key ? 'var(--color-primary)' : '#666',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Booking tab ── */}
      {activeSubTab === 'booking' && <>
        <section ref={calendarRef} style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.25rem' }}>
            {t('admin.booking_calendar')}
          </h2>
          <div className="card" style={{ padding: '1.5rem' }}>
            <BookingCalendar
              bookings={bookings}
              targetDate={calendarTargetDate}
              highlightedBookingId={highlightedBookingId}
            />
          </div>
        </section>

        {/* ── Bookings table ── */}
        <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>{t('admin.all_bookings')}</h2>
          <button onClick={() => setShowAdminBooking(true)} className="btn-primary" style={{ fontSize: '0.875rem' }}>
            + {t('admin.create_booking')}
          </button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '13%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)', backgroundColor: 'var(--color-bg)' }}>
                {[t('admin.col_ref'), t('admin.col_guest'), t('admin.col_stay'), t('admin.col_room'), t('admin.col_status')].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.8125rem', color: '#666', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr
                  key={b.id}
                  onClick={() => navigateToBooking(b)}
                  style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', backgroundColor: highlightedBookingId === b.id ? 'rgba(59,130,246,0.05)' : undefined, cursor: 'pointer' }}
                >
                  {/* Ref + price */}
                  <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <a
                        href={`/admin/booking/${b.id}`}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); const w = window.open(`/admin/booking/${b.id}`, '_blank'); if (w) { w.blur(); window.focus(); } }}
                        style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {b.bookingRef}
                      </a>
                      {(b.unreadMessages ?? 0) > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '1.125rem', height: '1.125rem', borderRadius: '999px', backgroundColor: '#ef4444', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '0 0.2rem' }}>
                          {b.unreadMessages}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '0.125rem' }}>{b.totalPrice.toLocaleString('da-DK')} kr</div>
                    {b.discountCode && <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>-{b.discountPercent}% {b.discountCode}</div>}
                    {b.isAdminCreated && <div style={{ fontSize: '0.7rem', color: '#aaa' }}>admin</div>}
                  </td>
                  {/* Guest */}
                  <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.guestName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.guestEmail}</div>
                  </td>
                  {/* Stay: dates + nights */}
                  <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {new Date(b.checkIn).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                      {' → '}
                      {new Date(b.checkOut).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>
                      {Math.round((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86400000)} {t('admin.nights')}
                    </div>
                  </td>
                  {/* Room + assignment */}
                  <td onClick={e => e.stopPropagation()} style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>
                    {b.bookingRooms && b.bookingRooms.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {b.bookingRooms.map(br => {
                          const isAssigned = br.roomId || br.assignedRoomId;
                          if (isAssigned) {
                            return (
                              <div key={br.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8rem', color: '#555' }}>{br.roomCategory?.name ?? '—'}</span>
                                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 500 }}>→ {br.room?.name ?? br.assignedRoom?.name}</span>
                                <button onClick={() => assignBookingRoom(b.id, br.id, null)} style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                              </div>
                            );
                          }
                          const takenInBooking = new Set(
                            b.bookingRooms.filter(o => o.id !== br.id && (o.assignedRoomId || o.roomId)).map(o => o.assignedRoomId || o.roomId).filter(Boolean)
                          );
                          const takenElsewhere = new Set(
                            bookings.filter(ob => ob.id !== b.id && ob.status !== 'CANCELLED' && ob.status !== 'CUSTOMER_CANCELLED' && ob.status !== 'NO_SHOW' &&
                              new Date(ob.checkIn) < new Date(b.checkOut) && new Date(ob.checkOut) > new Date(b.checkIn))
                              .flatMap(ob => [...(ob.bookingRooms?.flatMap(br2 => [br2.assignedRoomId, br2.roomId].filter(Boolean)) ?? []), ob.roomId, ob.assignedRoomId])
                              .filter(Boolean)
                          );
                          const eligible = rooms.filter(r => r.isActive && (!br.roomCategoryId || r.roomCategories.some(rc => rc.roomCategoryId === br.roomCategoryId)) && !takenInBooking.has(r.id) && !takenElsewhere.has(r.id));
                          return (
                            <div key={br.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 500 }}>{br.roomCategory?.name ?? '—'} — {t('admin.not_assigned')}</span>
                              <select value="" onChange={e => assignBookingRoom(b.id, br.id, e.target.value || null)}
                                style={{ fontSize: '0.8125rem', padding: '0.2rem 0.375rem', border: '1px solid #e0e0e0', borderRadius: '3px', cursor: 'pointer', maxWidth: '100%' }}>
                                <option value="">— {t('admin.assign_room')} —</option>
                                {eligible.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    ) : !b.roomId ? (
                      <select value={b.assignedRoomId ?? ''} onChange={e => assignLegacy(b.id, e.target.value || null)}
                        style={{ fontSize: '0.8125rem', padding: '0.2rem 0.375rem', border: '1px solid #e0e0e0', borderRadius: '3px', cursor: 'pointer', maxWidth: '100%' }}>
                        <option value="">— {t('admin.assign_room')} —</option>
                        {rooms.filter(r => r.isActive).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: '0.8125rem', color: '#555' }}>{b.room?.name ?? b.assignedRoom?.name}</span>
                    )}
                  </td>
                  {/* Status badge + change */}
                  <td onClick={e => e.stopPropagation()} style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>
                    <span style={{ display: 'inline-block', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '3px', backgroundColor: `${statusColors[b.status] ?? '#888'}22`, color: statusColors[b.status] ?? '#888', fontWeight: 600, marginBottom: '0.375rem' }}>
                      {t(`booking_status.${b.status}`, { defaultValue: b.status })}
                    </span>
                    <select value={b.status} onChange={e => updateBookingStatus(b.id, e.target.value)}
                      style={{ display: 'block', fontSize: '0.8125rem', padding: '0.2rem 0.375rem', border: '1px solid #e0e0e0', borderRadius: '3px', cursor: 'pointer', width: '100%' }}>
                      {['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'].map(s => (
                        <option key={s} value={s}>{t(`booking_status.${s}`, { defaultValue: s })}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>{t('admin.no_bookings')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </section>
      </>}

      {/* ── Rooms tab ── */}
      {activeSubTab === 'rooms' && <>
        {/* ── Room Categories ── */}
        <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.25rem' }}>{t('admin.room_categories')}</h2>
        <div className="card" style={{ padding: '1.5rem' }}>
          {categories.length === 0 && <p style={{ color: '#888', marginBottom: '1rem' }}>{t('admin.no_categories')}</p>}
          {categories.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginBottom: translatingId && categories.some(c => c.id === translatingId) ? '0.75rem' : 0 }}>
                {categories.map(cat => (
                  <span key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: translatingId === cat.id ? 'rgba(var(--color-primary-rgb,96,73,60),0.08)' : 'var(--color-bg)', border: `1px solid ${translatingId === cat.id ? 'var(--color-primary)' : '#e0e0e0'}`, borderRadius: '4px', padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                    {cat.name}
                    <button onClick={() => translatingId === cat.id ? setTranslatingId(null) : openTranslations(cat.id, cat.translations as Record<string, string> | undefined)} title={t('admin.edit_translations')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: translatingId === cat.id ? 'var(--color-primary)' : '#aaa', padding: 0, display: 'flex', alignItems: 'center' }}>
                      <GlobeIcon />
                    </button>
                    <button onClick={() => deleteCategory(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
              {translatingId && categories.some(c => c.id === translatingId) && (
                <div style={{ border: '1px solid #e0e0e0', borderRadius: '6px', padding: '1rem', backgroundColor: 'var(--color-bg)' }}>
                  <p style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '0.75rem' }}>{t('admin.edit_translations')}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginBottom: '0.75rem' }}>
                    {LANGS.map(({ code, label }) => (
                      <div key={code}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.2rem' }}>{label}</label>
                        <input className="input-field" value={transForm[code] ?? ''} onChange={e => setTransForm(f => ({ ...f, [code]: e.target.value }))} style={{ fontSize: '0.875rem' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => saveTranslations(`/room-categories/${translatingId}`)} className="btn-primary" disabled={savingTrans} style={{ fontSize: '0.8125rem' }}>{savingTrans ? '...' : t('common.save')}</button>
                    <button onClick={() => setTranslatingId(null)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>{t('common.cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {addingCategory ? (
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <input
                className="input-field"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Kategori navn..."
                style={{ maxWidth: '240px' }}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                autoFocus
              />
              <button onClick={addCategory} className="btn-primary" disabled={savingCategory} style={{ fontSize: '0.875rem' }}>
                {savingCategory ? t('common.loading') : t('common.save')}
              </button>
              <button onClick={() => { setAddingCategory(false); setNewCategoryName(''); }} className="btn-secondary" style={{ fontSize: '0.875rem' }}>{t('common.cancel')}</button>
            </div>
          ) : (
            <button onClick={() => setAddingCategory(true)} className="btn-primary" style={{ fontSize: '0.875rem' }}>{t('admin.add_category')}</button>
          )}
        </div>
      </section>

      </>}

      {activeSubTab === 'general' && <>
        {/* ── Calendar Sync ── */}
        <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.25rem' }}>{t('admin.calendar_sync')}</h2>
        <div className="card" style={{ padding: '1.5rem' }}>
          {calendarSources.length === 0 && (
            <p style={{ color: '#888', marginBottom: '1rem' }}>{t('admin.no_calendar_sources')}</p>
          )}
          {calendarSources.map(src => (
            <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{src.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>{src.feedUrl}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                  {src.rooms.length} {t('admin.linked_rooms').toLowerCase()}
                  {src.lastSync && <> · {t('admin.last_synced')}: {new Date(src.lastSync).toLocaleString()}</>}
                </div>
                {syncResult[src.id] && (
                  <div style={{ fontSize: '0.8rem', color: '#10b981' }}>
                    +{syncResult[src.id].added} {t('admin.added_count')}, {syncResult[src.id].updated} {t('admin.updated_count')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button onClick={() => syncSource(src.id)} className="btn-secondary" disabled={syncingSource === src.id} style={{ fontSize: '0.8125rem' }}>
                  {syncingSource === src.id ? t('common.loading') : t('admin.sync_now')}
                </button>
                <button onClick={() => openEditSource(src)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>{t('common.edit')}</button>
                <button onClick={() => deleteSource(src.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.8125rem' }}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '1rem' }}>
            <button onClick={openAddSource} className="btn-primary" style={{ fontSize: '0.875rem' }}>{t('admin.add_source')}</button>
          </div>
          {rooms.filter(r => r.isActive).length > 0 && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#555' }}>{t('admin.export_url')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {rooms.filter(r => r.isActive).map(room => (
                  <div key={room.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem' }}>
                    <span style={{ minWidth: '120px', fontWeight: 500 }}>{room.name}</span>
                    <button onClick={() => copyExportUrl(room.id)} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.625rem' }}>
                      Copy .ics URL
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      </>}

      {activeSubTab === 'rooms' && <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>{t('admin.rooms')}</h2>
          <button onClick={openAdd} className="btn-primary" style={{ fontSize: '0.875rem' }}>{t('admin.add_room')}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rooms.map(room => (
            <div key={room.id} className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1rem' }}>{room.name}</strong>
                  {room.roomCategories.map(rc => (
                    <span key={rc.roomCategoryId} style={{ fontSize: '0.75rem', backgroundColor: 'var(--color-bg)', border: '1px solid #e0e0e0', borderRadius: '3px', padding: '0.125rem 0.5rem', color: '#555' }}>
                      {rc.roomCategory.name}
                    </span>
                  ))}
                  {(closedPeriods[room.id] ?? []).length > 0 && (
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '3px', fontWeight: 500, backgroundColor: '#fef3c7', color: '#92400e' }}>
                      {(closedPeriods[room.id] ?? []).length} {t('admin.closed_periods').toLowerCase()}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#666' }}>
                  {t('rooms.max_guests', { count: room.maxGuests })}
                </div>
                {(closedPeriods[room.id] ?? []).map(p => (
                  <div key={p.id} style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '0.125rem' }}>
                    ⊘ {new Date(p.startDate).toLocaleDateString('da-DK')} – {new Date(p.endDate).toLocaleDateString('da-DK')}
                    {p.reason && <span style={{ color: '#aaa', marginLeft: '0.375rem' }}>({p.reason})</span>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button onClick={() => showQR(room.id, room.name)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>{t('admin.view_qr')}</button>
                <button onClick={() => openBlockPeriod(room)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>{t('admin.deactivate_period')}</button>
                <button onClick={() => openEdit(room)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>{t('common.edit')}</button>
              </div>
            </div>
          ))}
        </div>
      </section>}

      {activeSubTab === 'general' && <>
        {/* ── House Rules ── */}
        <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>{t('admin.house_rules_admin')}</h2>
          <button onClick={openAddRule} className="btn-primary" style={{ fontSize: '0.875rem' }}>
            + {t('admin.add_house_rule')}
          </button>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          {houseRules.length === 0 ? (
            <p style={{ color: '#888' }}>{t('admin.no_house_rules')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {houseRules.map((rule, idx) => (
                <React.Fragment key={rule.id}>
                <div
                  draggable
                  onDragStart={() => handleRuleDragStart(rule.id)}
                  onDragOver={e => handleRuleDragOver(e, rule.id)}
                  onDrop={() => handleRuleDrop(rule.id)}
                  onDragLeave={() => setDragOverRuleId(null)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: dragOverRuleId === rule.id ? 'rgba(var(--color-primary-rgb,96,73,60),0.06)' : 'var(--color-bg)',
                    borderRadius: '5px',
                    border: `1px solid ${dragOverRuleId === rule.id ? 'var(--color-primary)' : '#e0e0e0'}`,
                    cursor: 'grab', userSelect: 'none',
                    transition: 'border-color 0.1s, background-color 0.1s',
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: '#bbb', paddingTop: '0.15rem', flexShrink: 0 }}>⠿</span>
                  <span style={{ fontSize: '0.8125rem', color: '#aaa', minWidth: '1.25rem', paddingTop: '0.125rem', flexShrink: 0 }}>{idx + 1}.</span>
                  <span style={{ flex: 1, fontSize: '0.9375rem', lineHeight: 1.5 }}>{rule.text}</span>
                  <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center' }}>
                    <button onClick={() => openEditRule(rule)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>{t('common.edit')}</button>
                    <button onClick={() => translatingId === rule.id ? setTranslatingId(null) : openTranslations(rule.id, rule.translations)} title={t('admin.edit_translations')} style={{ background: 'none', border: `1px solid ${translatingId === rule.id ? 'var(--color-primary)' : '#ddd'}`, borderRadius: '4px', cursor: 'pointer', color: translatingId === rule.id ? 'var(--color-primary)' : '#aaa', padding: '0.25rem 0.35rem', display: 'flex', alignItems: 'center' }}>
                      <GlobeIcon />
                    </button>
                    <button onClick={() => deleteHouseRule(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.8125rem' }}>{t('common.delete')}</button>
                  </div>
                </div>
                {translatingId === rule.id && (
                  <div style={{ marginTop: '0.5rem', padding: '0.875rem', backgroundColor: 'rgba(var(--color-primary-rgb,96,73,60),0.04)', borderRadius: '5px', border: '1px solid rgba(var(--color-primary-rgb,96,73,60),0.15)' }}>
                    <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.625rem' }}>{t('admin.edit_translations')}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem 1rem', marginBottom: '0.625rem' }}>
                      {LANGS.map(({ code, label }) => (
                        <div key={code}>
                          <label style={{ display: 'block', fontSize: '0.7rem', color: '#999', marginBottom: '0.15rem' }}>{label}</label>
                          <input className="input-field" value={transForm[code] ?? ''} onChange={e => setTransForm(f => ({ ...f, [code]: e.target.value }))} style={{ fontSize: '0.8125rem' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => saveTranslations(`/house-rules/${rule.id}`)} className="btn-primary" disabled={savingTrans} style={{ fontSize: '0.8125rem' }}>{savingTrans ? '...' : t('common.save')}</button>
                      <button onClick={() => setTranslatingId(null)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>{t('common.cancel')}</button>
                    </div>
                  </div>
                )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Booking Settings ── */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.25rem' }}>{t('admin.booking_settings')}</h2>
        <div className="card" style={{ padding: '1.5rem', maxWidth: '480px' }}>
          <div>
            <label style={labelStyle}>{t('admin.booking_mode')}</label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                value={selectedMode}
                onChange={e => setSelectedMode(e.target.value as 'manual' | 'autonomous')}
                style={{ flex: 1, padding: '0.5rem', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '0.9375rem' }}
              >
                <option value="manual">{t('admin.booking_mode_manual')}</option>
                <option value="autonomous">{t('admin.booking_mode_autonomous')}</option>
              </select>
              <button onClick={saveBookingMode} className="btn-primary" disabled={savingMode || selectedMode === bookingMode} style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                {savingMode ? t('common.loading') : t('admin.booking_mode_save')}
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.375rem' }}>
              {t('admin.status_active')}: <strong>{bookingMode === 'manual' ? t('admin.booking_mode_manual') : t('admin.booking_mode_autonomous')}</strong>
            </p>
          </div>
          <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
            <label style={labelStyle}>Ankomst- og afreisetider</label>
            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem' }}>
              Vises til gæster ved booking. Standardværdier: ankomst 16:00, afrejse 10:00.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ ...labelStyle, fontSize: '0.875rem' }}>Ankomst fra</label>
                <input type="time" className="input-field" value={editArrival}
                  onChange={e => setEditArrival(e.target.value)} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: '0.875rem' }}>Afrejse inden</label>
                <input type="time" className="input-field" value={editDeparture}
                  onChange={e => setEditDeparture(e.target.value)} />
              </div>
            </div>
            <button
              onClick={saveCheckInTimes}
              className="btn-primary"
              disabled={savingTimes || (editArrival === arrivalTime && editDeparture === departureTime)}
              style={{ fontSize: '0.875rem' }}
            >
              {savingTimes ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </section>
      </>}

      {/* ── Room add/edit modal ── */}
      {roomModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              {roomModal.mode === 'add' ? t('admin.add_room') : `${t('common.edit')}: ${roomModal.room?.name}`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>{t('admin.room_name_label')} *</label>
                <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>{t('admin.room_desc_label')} *</label>
                <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>{t('admin.max_guests_label')} *</label>
                <input className="input-field" type="number" value={form.maxGuests} onChange={e => setForm(f => ({ ...f, maxGuests: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>{t('admin.amenities_label')} <span style={{ color: '#aaa', fontWeight: 400 }}>{t('admin.amenities_hint')}</span></label>
                <input className="input-field" value={form.amenities} onChange={e => setForm(f => ({ ...f, amenities: e.target.value }))} placeholder="WiFi, Parkering, Morgenmad" />
              </div>

              {categories.length > 0 && (
                <div>
                  <label style={labelStyle}>{t('admin.room_categories_label')}</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {categories.map(cat => (
                      <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9375rem' }}>
                        <input
                          type="checkbox"
                          checked={form.categoryIds.includes(cat.id)}
                          onChange={e => setForm(f => ({
                            ...f,
                            categoryIds: e.target.checked
                              ? [...f.categoryIds, cat.id]
                              : f.categoryIds.filter(id => id !== cat.id),
                          }))}
                        />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

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

      {/* ── QR Modal ── */}
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

      {/* ── Calendar Source Modal ── */}
      {sourceModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '520px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.25rem' }}>
              {sourceModal.mode === 'add' ? t('admin.add_source') : `${t('common.edit')}: ${sourceModal.source?.name}`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>{t('admin.source_name')} *</label>
                <input className="input-field" value={sourceForm.name} onChange={e => setSourceForm(f => ({ ...f, name: e.target.value }))} placeholder="Booking.com, Airbnb..." />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.feed_url')} *</label>
                <input className="input-field" type="url" value={sourceForm.feedUrl} onChange={e => setSourceForm(f => ({ ...f, feedUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label style={labelStyle}>{t('admin.linked_rooms')} *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {rooms.filter(r => r.isActive).map(room => (
                    <label key={room.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={sourceForm.roomIds.includes(room.id)}
                        onChange={e => setSourceForm(f => ({
                          ...f,
                          roomIds: e.target.checked
                            ? [...f.roomIds, room.id]
                            : f.roomIds.filter(id => id !== room.id),
                        }))}
                      />
                      {room.name}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setSourceModal(null)} className="btn-secondary">{t('common.cancel')}</button>
                <button onClick={saveSource} className="btn-primary" disabled={savingSource}>
                  {savingSource ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── House Rule Add/Edit Modal ── */}
      {showHouseRuleAdd && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '1.5rem' }}>
              {editingRule ? t('common.edit') : t('admin.add_house_rule')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>{t('admin.house_rule_text')} *</label>
                <textarea className="input-field" rows={3} value={ruleForm.text} style={{ resize: 'vertical' }}
                  onChange={e => setRuleForm(f => ({ ...f, text: e.target.value }))} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowHouseRuleAdd(false); setEditingRule(null); }} className="btn-secondary">{t('common.cancel')}</button>
                <button onClick={saveHouseRule} className="btn-primary" disabled={savingRule || !ruleForm.text.trim()}>
                  {savingRule ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Block Period Modal ── */}
      {blockPeriodModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
              {t('admin.deactivate_period_title')}
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem' }}>{blockPeriodModal.room.name}</p>

            {/* Get categories this room belongs to */}
            {(() => {
              const roomCats = blockPeriodModal.room.roomCategories.map(rc => rc.roomCategory);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={labelStyle}>{t('admin.deactivate_start')} *</label>
                      <input className="input-field" type="date" value={blockPeriodForm.startDate}
                        onChange={e => setBlockPeriodForm(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>{t('admin.deactivate_end')} *</label>
                      <input className="input-field" type="date" value={blockPeriodForm.endDate}
                        min={blockPeriodForm.startDate}
                        onChange={e => setBlockPeriodForm(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>{t('booking.notes')}</label>
                    <input className="input-field" value={blockPeriodForm.reason}
                      onChange={e => setBlockPeriodForm(f => ({ ...f, reason: e.target.value }))}
                      placeholder="Renovering, privat brug..." />
                  </div>
                  {roomCats.length > 0 && (
                    <div>
                      <label style={labelStyle}>{t('admin.block_period_categories')}</label>
                      <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                        Ingen markeret = blokerer for alle typer
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {roomCats.map(cat => (
                          <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}>
                            <input
                              type="checkbox"
                              checked={blockPeriodForm.categoryIds.includes(cat.id)}
                              onChange={e => setBlockPeriodForm(f => ({
                                ...f,
                                categoryIds: e.target.checked
                                  ? [...f.categoryIds, cat.id]
                                  : f.categoryIds.filter(id => id !== cat.id),
                              }))}
                            />
                            {cat.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={saveBlockPeriod}
                    className="btn-primary"
                    disabled={savingBlockPeriod || !blockPeriodForm.startDate || !blockPeriodForm.endDate}
                    style={{ fontSize: '0.875rem', alignSelf: 'flex-start' }}
                  >
                    {savingBlockPeriod ? t('common.loading') : t('admin.deactivate_period')}
                  </button>
                </div>
              );
            })()}

            {/* Existing closed periods */}
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#555' }}>{t('admin.closed_periods')}</div>
              {(closedPeriods[blockPeriodModal.room.id] ?? []).length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: '#888' }}>{t('admin.no_closed_periods')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {(closedPeriods[blockPeriodModal.room.id] ?? []).map(p => {
                    const catNames = p.roomCategoryIds.length > 0
                      ? p.roomCategoryIds.map(id => categories.find(c => c.id === id)?.name ?? id).join(', ')
                      : null;
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                        <div style={{ flex: 1 }}>
                          <div>
                            {new Date(p.startDate).toLocaleDateString('da-DK')} – {new Date(p.endDate).toLocaleDateString('da-DK')}
                            {p.reason && <span style={{ color: '#888', marginLeft: '0.5rem' }}>({p.reason})</span>}
                          </div>
                          {catNames ? (
                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.125rem' }}>{catNames}</div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '0.125rem' }}>alle typer</div>
                          )}
                        </div>
                        <button onClick={() => deleteBlockPeriod(blockPeriodModal.room.id, p.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.875rem' }}>
                          {t('common.delete')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setBlockPeriodModal(null)} className="btn-secondary">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Manual Booking Modal ── */}
      {showAdminBooking && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              {t('admin.create_booking')}
            </h3>

            {adminBookingError && (
              <p style={{ color: '#c0392b', fontSize: '0.875rem', padding: '0.625rem', backgroundColor: '#fdf0ef', borderRadius: '4px', marginBottom: '1rem' }}>
                {adminBookingError}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>{t('booking.guest_name')} *</label>
                  <input className="input-field" value={adminBookingForm.guestName} onChange={e => setAdminBookingForm(f => ({ ...f, guestName: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>{t('booking.guest_email')} *</label>
                  <input className="input-field" type="email" value={adminBookingForm.guestEmail} onChange={e => setAdminBookingForm(f => ({ ...f, guestEmail: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>{t('booking.guest_phone')}</label>
                  <input className="input-field" value={adminBookingForm.guestPhone} onChange={e => setAdminBookingForm(f => ({ ...f, guestPhone: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Status *</label>
                  <select className="input-field" value={adminBookingForm.status} onChange={e => setAdminBookingForm(f => ({ ...f, status: e.target.value as any }))}>
                    {['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t('booking.check_in')} *</label>
                  <input className="input-field" type="date" value={adminBookingForm.checkIn} onChange={e => setAdminBookingForm(f => ({ ...f, checkIn: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>{t('booking.check_out')} *</label>
                  <input className="input-field" type="date" value={adminBookingForm.checkOut} onChange={e => setAdminBookingForm(f => ({ ...f, checkOut: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>{t('booking.notes')}</label>
                <textarea className="input-field" rows={2} value={adminBookingForm.notes} onChange={e => setAdminBookingForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>

              {adminBookingNights > 0 && (
                <p style={{ fontSize: '0.8125rem', color: '#888' }}>
                  {t(adminBookingNights === 1 ? 'booking.nights' : 'booking.nights_plural', { count: adminBookingNights })}
                </p>
              )}

              {/* Room category selection */}
              <div>
                <label style={labelStyle}>{t('admin.room_categories')}</label>
                <select
                  className="input-field"
                  style={{ marginBottom: '0.5rem' }}
                  value=""
                  onChange={e => { if (e.target.value) addAdminRoom(e.target.value); }}
                >
                  <option value="">+ {t('admin.add_room')}...</option>
                  {categories.filter(c => !adminBookingRooms.find(ar => ar.roomCategoryId === c.id)).map(c => {
                    const avail = adminAvailability[c.id];
                    const unavailable = adminBookingForm.checkIn && adminBookingForm.checkOut && avail === 0;
                    return (
                      <option key={c.id} value={c.id} disabled={!!unavailable}>
                        {c.name}{adminBookingForm.checkIn && adminBookingForm.checkOut ? ` (${avail ?? '?'} available)` : ''}
                      </option>
                    );
                  })}
                </select>

                {adminBookingRooms.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {adminBookingRooms.map(ar => {
                      const cat = categories.find(c => c.id === ar.roomCategoryId);
                      const maxCount = adminAvailability[ar.roomCategoryId] ?? 99;
                      return (
                        <div key={ar.roomCategoryId} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 120px auto', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{cat?.name}</span>
                          <input
                            className="input-field"
                            type="number"
                            min="1"
                            max={maxCount}
                            value={ar.count}
                            onChange={e => setAdminBookingRooms(prev => prev.map(r => r.roomCategoryId === ar.roomCategoryId ? { ...r, count: Math.min(parseInt(e.target.value) || 1, maxCount) } : r))}
                            style={{ fontSize: '0.875rem', textAlign: 'center' }}
                            title={`Max ${maxCount} available`}
                          />
                          <input
                            className="input-field"
                            type="number"
                            placeholder={t('admin.per_night_dkk')}
                            value={ar.pricePerNight}
                            onChange={e => setAdminBookingRooms(prev => prev.map(r => r.roomCategoryId === ar.roomCategoryId ? { ...r, pricePerNight: e.target.value } : r))}
                            style={{ fontSize: '0.875rem' }}
                          />
                          <button onClick={() => removeAdminRoom(ar.roomCategoryId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}>×</button>
                        </div>
                      );
                    })}
                    {adminBookingNights > 0 && adminBookingTotal > 0 && (
                      <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                        {t('booking.total')}: {adminBookingTotal.toLocaleString('da-DK')} DKK
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button onClick={() => { setShowAdminBooking(false); setAdminBookingError(''); }} className="btn-secondary">{t('common.cancel')}</button>
                <button
                  onClick={saveAdminBooking}
                  className="btn-primary"
                  disabled={savingAdminBooking || !adminBookingForm.guestName || !adminBookingForm.guestEmail || !adminBookingForm.checkIn || !adminBookingForm.checkOut || adminBookingRooms.length === 0}
                >
                  {savingAdminBooking ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
