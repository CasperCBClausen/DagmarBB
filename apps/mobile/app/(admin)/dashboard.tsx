import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { getThemeColors } from '../../lib/theme';
import { apiClient } from '../../lib/apiClient';
import type { Booking, CleaningStatus } from '@dagmar/shared';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const colors = getThemeColors(theme);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [cleaning, setCleaning] = React.useState<CleaningStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = async () => {
    try {
      const [bRes, cRes] = await Promise.all([
        apiClient.get<Booking[]>('/bookings'),
        apiClient.get<CleaningStatus[]>('/cleaning/status'),
      ]);
      setBookings(bRes.data);
      setCleaning(cRes.data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  React.useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const todayCheckIns = bookings.filter(b =>
    b.checkIn.slice(0, 10) === today && ['CONFIRMED', 'PENDING'].includes(b.status)
  );
  const todayCheckOuts = bookings.filter(b =>
    b.checkOut.slice(0, 10) === today && ['CONFIRMED', 'CHECKED_IN'].includes(b.status)
  );
  const needsCleaning = cleaning.filter(c => c.state === 'NEEDS_CLEANING').length;
  const tomorrowCheckIns = bookings.filter(b =>
    b.checkIn.slice(0, 10) === tomorrow && ['CONFIRMED', 'PENDING'].includes(b.status)
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
      >
        <Text style={[styles.greeting, { color: colors.primary }]}>Goddag, {user?.name?.split(' ')[0]}</Text>
        <Text style={[styles.date, { color: '#888' }]}>
          {new Date().toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          {[
            { label: 'Ankomster i dag', value: todayCheckIns.length.toString(), color: colors.primary },
            { label: 'Afrejser i dag', value: todayCheckOuts.length.toString(), color: '#6b7280' },
            { label: 'Skal rengøres', value: needsCleaning.toString(), color: needsCleaning > 0 ? '#ef4444' : '#10b981' },
          ].map(kpi => (
            <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: 'white' }]}>
              <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* Today check-ins */}
        {todayCheckIns.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Ankomster i dag</Text>
            {todayCheckIns.map(b => (
              <View key={b.id} style={styles.bookingCard}>
                <Text style={styles.guestName}>{b.guestName}</Text>
                <Text style={styles.roomName}>{b.room?.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Today check-outs */}
        {todayCheckOuts.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Afrejser i dag</Text>
            {todayCheckOuts.map(b => (
              <View key={b.id} style={styles.bookingCard}>
                <Text style={styles.guestName}>{b.guestName}</Text>
                <Text style={styles.roomName}>{b.room?.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tomorrow */}
        {tomorrowCheckIns.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Ankomster i morgen</Text>
            {tomorrowCheckIns.map(b => (
              <View key={b.id} style={styles.bookingCard}>
                <Text style={styles.guestName}>{b.guestName}</Text>
                <Text style={styles.roomName}>{b.room?.name}</Text>
              </View>
            ))}
          </View>
        )}

        {todayCheckIns.length === 0 && todayCheckOuts.length === 0 && tomorrowCheckIns.length === 0 && (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: '#888', fontSize: 15 }}>Ingen bevægelser i dag eller i morgen</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  greeting: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  date: { fontSize: 14, marginBottom: 20 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  kpiCard: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  kpiValue: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  kpiLabel: { fontSize: 11, color: '#888', textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  bookingCard: { backgroundColor: 'white', borderRadius: 8, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  guestName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  roomName: { fontSize: 13, color: '#888', marginTop: 2 },
});
