import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { getThemeColors } from '../../lib/theme';
import { apiClient } from '../../lib/apiClient';
import type { FinancialSummary } from '@dagmar/shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const { width } = Dimensions.get('window');

export default function FinancialsScreen() {
  const { theme } = useThemeStore();
  const colors = getThemeColors(theme);
  const [data, setData] = React.useState<FinancialSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = async () => {
    try {
      const res = await apiClient.get<FinancialSummary>('/financials/summary');
      setData(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  React.useEffect(() => { load(); }, []);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>;
  }

  if (!data) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: '#888' }}>Kunne ikke indlæse finansielle data</Text>
    </View>;
  }

  const maxRevenue = Math.max(...data.revenueByMonth.map(m => m.revenue), 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
      >
        <Text style={[styles.title, { color: colors.text }]}>Økonomi</Text>

        {/* KPI cards */}
        <View style={styles.kpiGrid}>
          {[
            { label: 'Omsætning', value: `${data.totalRevenue.toLocaleString('da-DK')} DKK` },
            { label: 'Bookinger', value: data.totalBookings.toString() },
            { label: 'Belægning', value: `${data.occupancyRate.toFixed(1)}%` },
            { label: 'Gns. ophold', value: `${data.averageStay.toFixed(1)} nætter` },
          ].map(kpi => (
            <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: 'white' }]}>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* Simple bar chart */}
        <View style={[styles.chartCard, { backgroundColor: 'white' }]}>
          <Text style={styles.chartTitle}>Månedlig omsætning (seneste 12 måneder)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingTop: 16, paddingBottom: 8, gap: 4 }}>
              {data.revenueByMonth.map((m, i) => {
                const barHeight = Math.max(4, (m.revenue / maxRevenue) * 120);
                return (
                  <View key={i} style={{ alignItems: 'center', width: 32 }}>
                    {m.revenue > 0 && (
                      <Text style={{ fontSize: 8, color: '#888', marginBottom: 2, textAlign: 'center' }}>
                        {Math.round(m.revenue / 1000)}k
                      </Text>
                    )}
                    <View style={{ width: 24, height: barHeight, backgroundColor: colors.primary, borderRadius: 3 }} />
                    <Text style={{ fontSize: 9, color: '#888', marginTop: 4 }}>{MONTHS[m.month - 1]}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* By room */}
        <View style={[styles.chartCard, { backgroundColor: 'white' }]}>
          <Text style={styles.chartTitle}>Omsætning pr. værelse</Text>
          {data.revenueByRoom.map(r => (
            <View key={r.roomId} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: '#1A1A1A' }}>{r.roomName}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                  {r.revenue.toLocaleString('da-DK')} DKK
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: 3 }}>
                <View style={{
                  height: 6,
                  width: `${Math.min(100, r.occupancyRate)}%`,
                  backgroundColor: colors.accent,
                  borderRadius: 3,
                }} />
              </View>
              <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                {r.occupancyRate.toFixed(1)}% belægning · {r.bookings} bookinger
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, minWidth: '45%', borderRadius: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  kpiValue: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  kpiLabel: { fontSize: 12, color: '#888' },
  chartCard: { borderRadius: 10, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 12 },
});
