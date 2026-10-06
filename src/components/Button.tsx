import React from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../design';
import { Text } from './Text';

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style'> {
  /** Visual weight of the button */
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  /** Stretch to fill the parent width */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  children: string;
}

/**
 * Text button primitive with press feedback (opacity + scale). Reanimated-based
 * spring feedback and haptics are layered in during the motion stage.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const { colors, spacing, radius } = useTheme();

  const paddings =
    size === 'sm'
      ? { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }
      : { paddingHorizontal: spacing.lg, paddingVertical: spacing.md };

  const background =
    variant === 'primary'
      ? colors.accent
      : variant === 'secondary'
      ? colors.surfaceSunken
      : 'transparent';

  const labelColor =
    variant === 'primary'
      ? colors.textOnAccent
      : variant === 'ghost'
      ? colors.accent
      : colors.textPrimary;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          ...paddings,
          backgroundColor: background,
          borderRadius: radius.md,
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: pressed ? 0.82 : disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <Text
        variant="label"
        weight="600"
        style={{ color: labelColor, textAlign: 'center' }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
