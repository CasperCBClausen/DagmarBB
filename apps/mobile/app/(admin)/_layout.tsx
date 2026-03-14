import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { getThemeColors } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLayout() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const colors = getThemeColors(theme);

  if (!user || !['ADMIN', 'CLEANER'].includes(user.role)) {
    return <Redirect href="/login" />;
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { backgroundColor: 'white', borderTopColor: 'rgba(0,0,0,0.08)', paddingBottom: 4 },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookinger',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cleaning"
        options={{
          title: 'Rengøring',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />,
        }}
      />
      {isAdmin && (
        <Tabs.Screen
          name="rooms"
          options={{
            title: 'Værelser',
            tabBarIcon: ({ color, size }) => <Ionicons name="bed-outline" size={size} color={color} />,
          }}
        />
      )}
      {isAdmin && (
        <Tabs.Screen
          name="financials"
          options={{
            title: 'Økonomi',
            tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
          }}
        />
      )}
      {!isAdmin && <Tabs.Screen name="rooms" options={{ href: null }} />}
      {!isAdmin && <Tabs.Screen name="financials" options={{ href: null }} />}
      <Tabs.Screen name="settings" options={{
        title: 'Indstillinger',
        tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
