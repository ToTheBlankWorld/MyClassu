import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { Theme } from './theme';
import { darkTheme, lightTheme } from './theme';

/**
 * Theme provider. Follows the OS light/dark setting; an explicit in-app
 * override can be added to Settings in a later stage without changing
 * consumers (the resolution logic lives here).
 */

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
});

export interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const scheme = useColorScheme();
  const value = useMemo<ThemeContextValue>(
    () => ({ theme: scheme === 'dark' ? darkTheme : lightTheme }),
    [scheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeColors(): Theme['colors'] {
  return useContext(ThemeContext).theme.colors;
}
