import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { getThemeColors } from '../../lib/theme';
import { apiClient } from '../../lib/apiClient';
import type { CleaningStatus } from '@dagmar/shared';

const STATE_CONFIG = {
  CLEAN:          { label: 'Rent',          color: '#059669', bg: '#d1fae5', emoji: '✓' },
  NEEDS_CLEANING: { label: 'Skal rengøres', color: '#dc2626', bg: '#fee2e2', emoji: '!' },
  IN_PROGRESS:    { label: 'I gang',         color: '#d97706', bg: '#fef3c7', emoji: '↻' },
};

export default function CleaningScreen() {
  const { theme } = useThemeStore();
  const colors = getThemeColors(theme);
  const [statuses, setStatuses] = React.useState<CleaningStatus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [updating, setUpdating] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);

  const load = async () => {
    try {
      const res = await apiClient.get<CleaningStatus[]>('/cleaning/status');
      setStatuses(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  React.useEffect(() => { load(); }, []);

  const updateState = async (roomId: string, state: 'CLEAN' | 'NEEDS_CLEANING' | 'IN_PROGRESS') => {
    setUpdating(roomId);
    try {
      await apiClient.patch(`/cleaning/${roomId}`, { state });
      load();
    } catch {
      Alert.alert('Fejl', 'Kunne ikke opdatere status.');
    } finally {
      setUpdating(null);
    }
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
        <Text style={[styles.title, { color: colors.text }]}>Rengøring</Text>
        {statuses.map(s => {
          const cfg = STATE_CONFIG[s.state];
          const isUpdating = updating === s.roomId;
          return (
            <View key={s.roomId} style={[styles.card, { borderLeftColor: cfg.color, borderLeftWidth: 4 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <Text style={styles.roomName}>{s.room?.name}</Text>
                <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
                </View>
              </View>
              <Text style={styles.timestamp}>
                Opdateret: {new Date(s.updatedAt).toLocaleString('da-DK')}
              </Text>
              <View style={styles.actions}>
                {s.state !== 'CLEAN' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => updateState(s.roomId, 'CLEAN')}
                    disabled={isUpdating}
                  >
                    <Text style={styles.actionBtnText}>Markér rent</Text>
                  </TouchableOpacity>
                )}
                {s.state !== 'IN_PROGRESS' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: cfg.color === '#d97706' ? '#f3f4f6' : '#fef3c7', borderColor: '#d97706', borderWidth: 1 }]}
                    onPress={() => updateState(s.roomId, 'IN_PROGRESS')}
                    disabled={isUpdating}
                  >
                    <Text style={[styles.actionBtnText, { color: '#d97706' }]}>Start rengøring</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        {statuses.length === 0 && (
          <Text style={{ color: '#888', textAlign: 'center', padding: 32 }}>Ingen rum at rengøre</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: 'white', borderRadius: 10, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  roomName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  timestamp: { fontSize: 12, color: '#aaa', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  actionBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
});
