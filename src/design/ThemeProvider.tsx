import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Theme } from './theme';
import { darkTheme, lightTheme } from './theme';

/**
 * Theme provider. Supports three preferences:
 *   'system' (default) — follows the OS setting
 *   'light' / 'dark'   — explicit override
 * The preference lives here so the Settings screen has one place to
 * control it; components only ever consume resolved tokens. The choice
 * persists across restarts (malformed/missing storage → system).
 */

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'myclassu.themePreference.v1';

function sanitizePreference(raw: unknown): ThemePreference | null {
  return raw === 'system' || raw === 'light' || raw === 'dark' ? raw : null;
}

export async function loadThemePreference(): Promise<ThemePreference | null> {
  try {
    return sanitizePreference(await AsyncStorage.getItem(THEME_PREFERENCE_KEY));
  } catch {
    return null;
  }
}

export async function saveThemePreference(
  preference: ThemePreference,
): Promise<void> {
  await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
}

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  preference: 'system',
  setPreference: () => {
    // No provider mounted: preference changes are dropped.
  },
});

export interface ThemeProviderProps {
  /** Initial preference; defaults to following the system. */
  initialPreference?: ThemePreference;
  children: React.ReactNode;
}

export function ThemeProvider({
  initialPreference = 'system',
  children,
}: ThemeProviderProps) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(initialPreference);
  const scheme = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    loadThemePreference()
      .then(stored => {
        if (!cancelled && stored) {
          setPreferenceState(stored);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    saveThemePreference(next).catch(() => undefined);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const isDark =
      preference === 'system' ? scheme === 'dark' : preference === 'dark';
    return {
      theme: isDark ? darkTheme : lightTheme,
      preference,
      setPreference,
    };
  }, [preference, scheme, setPreference]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Resolved theme tokens (always use this for styling). */
export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeColors(): Theme['colors'] {
  return useContext(ThemeContext).theme.colors;
}

/** Current preference + setter, for settings UI. */
export function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} {
  const { preference, setPreference } = useContext(ThemeContext);
  return { preference, setPreference };
}
