import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { Theme } from './theme';
import { darkTheme, lightTheme } from './theme';

/**
 * Theme provider. Supports three preferences:
 *   'system' (default) — follows the OS setting
 *   'light' / 'dark'   — explicit override
 * The preference lives here so the Settings screen (and later, persistence)
 * has one place to control it; components only ever consume resolved tokens.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

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
  const [preference, setPreference] =
    useState<ThemePreference>(initialPreference);
  const scheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const isDark =
      preference === 'system' ? scheme === 'dark' : preference === 'dark';
    return {
      theme: isDark ? darkTheme : lightTheme,
      preference,
      setPreference,
    };
  }, [preference, scheme]);

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
