import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getThemeColors } from '../lib/theme';
import { apiClient } from '../lib/apiClient';
import type { LoginResponse } from '@dagmar/shared';

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { theme } = useThemeStore();
  const colors = getThemeColors(theme);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Fejl', 'Udfyld venligst e-mail og adgangskode.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<LoginResponse>('/auth/login', { email, password });
      await setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      router.replace('/(admin)/dashboard');
    } catch {
      Alert.alert('Fejl', 'Forkert e-mail eller adgangskode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.bg }]}
    >
      <View style={styles.card}>
        <Text style={[styles.brand, { color: colors.primary }]}>Dagmar B&B</Text>
        <Text style={[styles.subtitle, { color: colors.accent }]}>RIBE · DENMARK</Text>
        <Text style={styles.loginLabel}>Personalets login</Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={[styles.input, { borderColor: '#e0e0e0', color: colors.text }]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="din@email.dk"
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>Adgangskode</Text>
        <TextInput
          style={[styles.input, { borderColor: '#e0e0e0', color: colors.text }]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#aaa"
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Log ind</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: 'white', borderRadius: 12, padding: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  brand: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 11, letterSpacing: 2, textAlign: 'center', marginBottom: 28 },
  loginLabel: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16, backgroundColor: 'white' },
  button: { borderRadius: 6, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
});
