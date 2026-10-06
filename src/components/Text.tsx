import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { useTheme, type Theme, type TypographyVariant } from '../design';

export type TextColorRole =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'onAccent'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

export interface TextProps extends RNTextProps {
  /** Typography role from the design-token scale */
  variant?: TypographyVariant;
  /** Semantic color role */
  color?: TextColorRole;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
}

const colorRoleMap: Record<TextColorRole, keyof Theme['colors']> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  muted: 'textMuted',
  onAccent: 'textOnAccent',
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function Text({
  variant = 'body',
  color = 'primary',
  align,
  weight,
  style,
  ...rest
}: TextProps) {
  const { colors, typography } = useTheme();

  return (
    <RNText
      {...rest}
      style={[
        {
          ...typography[variant],
          color: colors[colorRoleMap[color]],
          textAlign: align,
          fontWeight: weight,
        },
        style,
      ]}
    />
  );
}
