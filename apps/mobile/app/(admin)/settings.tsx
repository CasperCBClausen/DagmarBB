import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { getThemeColors } from '../../lib/theme';
import { apiClient } from '../../lib/apiClient';
import { themeNames, themeLabels, themes, type ThemeName } from '@dagmar/shared';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const colors = getThemeColors(theme);

  const handleLogout = async () => {
    Alert.alert('Log ud', 'Er du sikker på, at du vil logge ud?', [
      { text: 'Annuller', style: 'cancel' },
      {
        text: 'Log ud',
        style: 'destructive',
        onPress: async () => {
          try {
            if (refreshToken) await apiClient.post('/auth/logout', { refreshToken });
          } catch { /* ignore */ }
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.title, { color: colors.text }]}>Indstillinger</Text>

        {/* User info */}
        <View style={[styles.section, { backgroundColor: 'white' }]}>
          <Text style={styles.sectionTitle}>Konto</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Navn</Text>
            <Text style={styles.value}>{user?.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>E-mail</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Rolle</Text>
            <Text style={styles.value}>{user?.role}</Text>
          </View>
        </View>

        {/* Theme switcher */}
        <View style={[styles.section, { backgroundColor: 'white' }]}>
          <Text style={styles.sectionTitle}>Tema</Text>
          {themeNames.map(name => (
            <TouchableOpacity
              key={name}
              onPress={() => setTheme(name)}
              style={[styles.themeRow, theme === name && { backgroundColor: '#f3f4f6' }]}
            >
              <View style={[styles.swatch, { backgroundColor: (themes[name] as any)['--color-primary'] }]} />
              <Text style={{ flex: 1, fontSize: 14, color: '#1A1A1A' }}>{themeLabels[name]}</Text>
              {theme === name && <Text style={{ color: colors.primary, fontWeight: '600' }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutBtn, { borderColor: '#ef4444' }]}
        >
          <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 15 }}>Log ud</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  section: { borderRadius: 12, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#888', padding: 14, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  label: { fontSize: 14, color: '#888' },
  value: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
  themeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
  swatch: { width: 20, height: 20, borderRadius: 10 },
  logoutBtn: { borderWidth: 1.5, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
});
