import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

// This component handles the redirect logic
function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      // If not logged in and not in the auth screen, go to Login
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // If logged in and trying to go to login, go to Tabs
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  if (isLoading) return null; // Show nothing while checking login

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" options={{ title: 'Login' }} />
        <Stack.Screen name="auth/register" options={{ title: 'Create Account' }} />
        <Stack.Screen name="supplier/[id]" options={{ presentation: 'modal', title: 'Supplier Catalog', headerShown: true }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat', headerShown: true }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

// The Main Export wraps everything in AuthProvider
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
