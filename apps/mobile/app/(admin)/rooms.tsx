import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { getThemeColors } from '../../lib/theme';
import { apiClient } from '../../lib/apiClient';
import type { Room } from '@dagmar/shared';

export default function RoomsScreen() {
  const { theme } = useThemeStore();
  const colors = getThemeColors(theme);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [qr, setQr] = React.useState<{ name: string; dataUrl: string } | null>(null);

  const load = async () => {
    try {
      const res = await apiClient.get<Room[]>('/rooms/all');
      setRooms(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  React.useEffect(() => { load(); }, []);

  const showQR = async (room: Room) => {
    try {
      const res = await apiClient.get<{ qrDataUrl: string }>(`/rooms/${room.id}/qr`);
      setQr({ name: room.name, dataUrl: res.data.qrDataUrl });
    } catch { /* ignore */ }
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
        <Text style={[styles.title, { color: colors.text }]}>Værelser</Text>
        {rooms.map(room => (
          <View key={room.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={styles.roomName}>{room.name}</Text>
              <View style={[styles.badge, { backgroundColor: room.isActive ? '#d1fae5' : '#fee2e2' }]}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: room.isActive ? '#059669' : '#dc2626' }}>
                  {room.isActive ? 'Aktiv' : 'Inaktiv'}
                </Text>
              </View>
            </View>
            <Text style={styles.detail}>{room.pricePerNight.toLocaleString('da-DK')} DKK / nat · op til {room.maxGuests} gæster</Text>
            <Text style={styles.description} numberOfLines={2}>{room.description}</Text>
            <TouchableOpacity
              onPress={() => showQR(room)}
              style={[styles.qrBtn, { borderColor: colors.primary }]}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500' }}>Vis QR-kode</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {qr && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>QR-kode: {qr.name}</Text>
            <Image source={{ uri: qr.dataUrl }} style={{ width: 220, height: 220, marginVertical: 16 }} />
            <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
              Udskriv og placer i værelset til rengøringspersonalet.
            </Text>
            <TouchableOpacity onPress={() => setQr(null)} style={[styles.closeBtn, { backgroundColor: colors.primary }]}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Luk</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: 'white', borderRadius: 10, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  roomName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  detail: { fontSize: 13, color: '#888', marginTop: 6, marginBottom: 6 },
  description: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 12 },
  qrBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1.5, alignSelf: 'flex-start' },
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center', width: '85%', maxWidth: 360 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  closeBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
});
