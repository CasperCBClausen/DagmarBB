import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, isLoaded } = useAuthStore();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7A3B1E" />
      </View>
    );
  }

  if (user && ['ADMIN', 'CLEANER'].includes(user.role)) {
    return <Redirect href="/(admin)/dashboard" />;
  }

  return <Redirect href="/login" />;
}
