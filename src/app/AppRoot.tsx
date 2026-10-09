import { StatusBar } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../design';
import { ToastProvider } from '../components';
import { useClassReminders } from '../features/reminders/useClassReminders';
import { useAttendanceSync } from '../features/attendance/useAttendanceSync';
import { RootNavigator } from '../navigation/RootNavigator';

/**
 * Composition root: providers → navigation. Screens and features render
 * inside this tree; App.tsx only mounts this component.
 */

function ThemedNavigator() {
  const theme = useTheme();
  // Native class-reminder sync: idempotent, offline-first, never blocks UI.
  useClassReminders();
  // Attendance outbox flush: best-effort upload, silent when offline.
  useAttendanceSync();

  const navigationTheme = {
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme : DefaultTheme).colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      primary: theme.colors.accent,
      notification: theme.colors.danger,
    },
  };

  return (
    <>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export function AppRoot() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <ThemedNavigator />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
