import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme, type IconSizeToken, type Theme } from '../design';

export type IconColorRole =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'onAccent'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

export interface IconProps {
  /** Lucide icon component (consistent stroke-based icon language) */
  glyph: LucideIcon;
  size?: IconSizeToken;
  color?: IconColorRole;
  /** Stroke width; 2 is the Lucide default and the app standard */
  strokeWidth?: number;
  accessibilityLabel?: string;
}

const colorRoleMap: Record<IconColorRole, keyof Theme['colors']> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  muted: 'textMuted',
  onAccent: 'textOnAccent',
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/**
 * App-wide icon. All icons come from Lucide (one visual language); size and
 * color always resolve through theme tokens.
 */
export function Icon({
  glyph: Glyph,
  size = 'md',
  color = 'primary',
  strokeWidth = 2,
  accessibilityLabel,
}: IconProps) {
  const { colors, iconSize } = useTheme();

  return (
    <Glyph
      size={iconSize[size]}
      color={colors[colorRoleMap[color]]}
      strokeWidth={strokeWidth}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
