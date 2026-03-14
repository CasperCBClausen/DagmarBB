import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export default function RootLayout() {
  const { loadFromStorage } = useAuthStore();
  const { loadTheme } = useThemeStore();

  useEffect(() => {
    loadFromStorage();
    loadTheme();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
