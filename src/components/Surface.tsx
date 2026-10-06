import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../design';

export interface SurfaceProps extends ViewProps {
  /** Visual elevation level of the surface */
  level?: 'base' | 'raised' | 'sunken';
  /** Hairline border (on by default for base/raised in both themes) */
  bordered?: boolean;
}

/**
 * The single container primitive all card-like UI should build on. It owns
 * surface color, border and (later) elevation/shadow treatment so the visual
 * language stays consistent.
 */
export function Surface({
  level = 'base',
  bordered = true,
  style,
  ...rest
}: SurfaceProps) {
  const { colors, radius } = useTheme();

  const background =
    level === 'raised'
      ? colors.surfaceRaised
      : level === 'sunken'
      ? colors.surfaceSunken
      : colors.surface;

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: background,
          borderRadius: radius.lg,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    />
  );
}
