import React from 'react';
import type { ViewProps } from 'react-native';
import { useTheme } from '../design';
import { Surface, type SurfaceProps } from './Surface';

export interface CardProps extends ViewProps {
  /** Visual elevation level, forwarded to the underlying Surface */
  level?: SurfaceProps['level'];
  /** Card interior padding (defaults to spacing.lg) */
  padding?: number;
}

/**
 * Surface + standard interior padding. Use for grouped content; avoid nesting
 * cards inside cards.
 */
export function Card({ level, padding, style, ...rest }: CardProps) {
  const { spacing } = useTheme();

  return (
    <Surface
      level={level}
      {...rest}
      style={[{ padding: padding ?? spacing.lg }, style]}
    />
  );
}
