import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

// 1. Import the AuthProvider we created
import { AuthProvider } from '../context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme'; // Keep your existing hook

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // 2. Wrap everything in AuthProvider so the whole app handles Login state
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Main App (Tabs) */}
          <Stack.Screen name="(tabs)" />

          {/* Auth Screens */}
          <Stack.Screen name="auth/login" options={{ title: 'Login' }} />
          <Stack.Screen name="auth/register" options={{ title: 'Create Account' }} />

          {/* Dynamic Screens */}
          <Stack.Screen 
            name="supplier/[id]" 
            options={{ presentation: 'modal', title: 'Supplier Catalog', headerShown: true }} 
          />
          <Stack.Screen 
             name="chat/[id]" 
             options={{ title: 'Chat', headerShown: true }} 
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
