import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '../design';
import { Text, type TextColorRole } from './Text';

export interface BadgeProps extends ViewProps {
  /** Visual tone of the badge */
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  children: string;
}

const toneMap: Record<
  NonNullable<BadgeProps['tone']>,
  { bg: keyof ReturnType<typeof useTheme>['colors']; fg: TextColorRole }
> = {
  neutral: { bg: 'surfaceSunken', fg: 'secondary' },
  accent: { bg: 'accentTint', fg: 'accent' },
  success: { bg: 'successTint', fg: 'success' },
  warning: { bg: 'warningTint', fg: 'warning' },
  danger: { bg: 'dangerTint', fg: 'danger' },
};

export function Badge({
  tone = 'neutral',
  children,
  style,
  ...rest
}: BadgeProps) {
  const { colors, spacing, radius } = useTheme();
  const { bg, fg } = toneMap[tone];

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors[bg],
          borderRadius: radius.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs + 1,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text variant="metadata" color={fg}>
        {children}
      </Text>
    </View>
  );
}
