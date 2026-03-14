import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { getThemeColors } from '../../lib/theme';
import { apiClient } from '../../lib/apiClient';
import type { Booking, BookingStatus } from '@dagmar/shared';

const STATUS_COLORS: Record<BookingStatus, { bg: string; text: string }> = {
  PENDING:     { bg: '#fef3c7', text: '#d97706' },
  CONFIRMED:   { bg: '#d1fae5', text: '#059669' },
  CHECKED_IN:  { bg: '#dbeafe', text: '#2563eb' },
  CHECKED_OUT: { bg: '#f3f4f6', text: '#6b7280' },
  CANCELLED:   { bg: '#fee2e2', text: '#dc2626' },
  NO_SHOW:     { bg: '#f3f4f6', text: '#9ca3af' },
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Afventer',
  CONFIRMED: 'Bekræftet',
  CHECKED_IN: 'Indtjekket',
  CHECKED_OUT: 'Udtjekket',
  CANCELLED: 'Annulleret',
  NO_SHOW: 'Udeblevet',
};

export default function BookingsScreen() {
  const { theme } = useThemeStore();
  const colors = getThemeColors(theme);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selected, setSelected] = React.useState<Booking | null>(null);

  const load = async () => {
    try {
      const res = await apiClient.get<Booking[]>('/bookings');
      setBookings(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  React.useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: BookingStatus) => {
    await apiClient.patch(`/bookings/${id}/status`, { status });
    load();
    setSelected(null);
  };

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
      >
        <Text style={[styles.title, { color: colors.text }]}>Bookinger</Text>
        {bookings.map(b => {
          const sc = STATUS_COLORS[b.status];
          return (
            <TouchableOpacity key={b.id} onPress={() => setSelected(b)} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guestName}>{b.guestName}</Text>
                  <Text style={styles.roomName}>{b.room?.name}</Text>
                  <Text style={styles.dates}>
                    {new Date(b.checkIn).toLocaleDateString('da-DK')} → {new Date(b.checkOut).toLocaleDateString('da-DK')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.badgeText, { color: sc.text }]}>{STATUS_LABELS[b.status]}</Text>
                  </View>
                  <Text style={[styles.price, { color: colors.primary }]}>{b.totalPrice.toLocaleString('da-DK')} DKK</Text>
                </View>
              </View>
              <Text style={styles.ref}>{b.bookingRef}</Text>
            </TouchableOpacity>
          );
        })}
        {bookings.length === 0 && (
          <Text style={{ color: '#888', textAlign: 'center', padding: 32 }}>Ingen bookinger endnu</Text>
        )}
      </ScrollView>

      {/* Status update modal */}
      {selected && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{selected.guestName}</Text>
            <Text style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>{selected.bookingRef}</Text>
            <Text style={{ fontWeight: '600', marginBottom: 10, color: '#444' }}>Skift status til:</Text>
            {(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'] as BookingStatus[]).map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => updateStatus(selected.id, s)}
                style={[styles.statusBtn, s === selected.status && { borderColor: colors.primary, borderWidth: 2 }]}
              >
                <Text style={{ color: STATUS_COLORS[s].text, fontWeight: '500' }}>{STATUS_LABELS[s]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setSelected(null)} style={[styles.statusBtn, { marginTop: 8, backgroundColor: '#f3f4f6' }]}>
              <Text style={{ color: '#666' }}>Annuller</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: 'white', borderRadius: 10, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  guestName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  roomName: { fontSize: 13, color: '#666', marginBottom: 2 },
  dates: { fontSize: 12, color: '#888' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  price: { fontSize: 14, fontWeight: '600' },
  ref: { fontFamily: 'monospace', fontSize: 11, color: '#aaa', marginTop: 8 },
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: 'white', borderRadius: 16, padding: 24, width: '85%', maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  statusBtn: { padding: 12, borderRadius: 8, backgroundColor: '#f9fafb', marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
});
