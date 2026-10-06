import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme, type SpacingToken } from '../design';

export type Gap = SpacingToken | number;

export interface StackProps extends ViewProps {
  /** Gap between children — a spacing token name or an explicit number */
  gap?: Gap;
  align?: 'start' | 'center' | 'end' | 'stretch';
}

const alignMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
} as const;

function gapValue(
  gap: Gap,
  spacing: ReturnType<typeof useTheme>['spacing'],
): number {
  return typeof gap === 'number' ? gap : spacing[gap];
}

/**
 * Vertical layout primitive. Use `gap` instead of margins between children.
 */
export function Stack({
  gap = 0,
  align = 'stretch',
  style,
  ...rest
}: StackProps) {
  const { spacing } = useTheme();

  return (
    <View
      {...rest}
      style={[
        {
          flexDirection: 'column',
          gap: gapValue(gap, spacing),
          alignItems: alignMap[align],
        },
        style,
      ]}
    />
  );
}

export interface RowProps extends Omit<StackProps, 'align'> {
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
}

const justifyMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
} as const;

const rowAlignMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  baseline: 'baseline',
  stretch: 'stretch',
} as const;

/**
 * Horizontal layout primitive. Use `gap` instead of margins between children.
 */
export function Row({
  gap = 0,
  align = 'center',
  justify = 'start',
  style,
  ...rest
}: RowProps) {
  const { spacing } = useTheme();

  return (
    <View
      {...rest}
      style={[
        {
          flexDirection: 'row',
          gap: gapValue(gap, spacing),
          alignItems: rowAlignMap[align],
          justifyContent: justifyMap[justify],
        },
        style,
      ]}
    />
  );
}
