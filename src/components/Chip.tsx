import React from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AnimatedPressable, haptics, usePressScale, useTheme } from '../design';
import { Text } from './Text';
import { Icon, type IconColorRole } from './Icon';

export interface ChipProps
  extends Omit<
    React.ComponentProps<typeof AnimatedPressable>,
    'children' | 'style' | 'onPress' | 'onPressIn' | 'onPressOut' | 'ref'
  > {
  label: string;
  glyph?: LucideIcon;
  selected?: boolean;
  /** Selection-change haptic (defaults to on) */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  children?: never;
}

/**
 * Compact selectable pill — filters, reason categories, quick toggles.
 * Selected state is communicated by color AND the accessibility state.
 */
export function Chip({
  label,
  glyph,
  selected = false,
  haptic: hapticEnabled = true,
  disabled,
  style,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: ChipProps) {
  const { colors, spacing, radius, opacity: opacityToken } = useTheme();
  const {
    animatedStyle,
    onPressIn: scaleIn,
    onPressOut: scaleOut,
  } = usePressScale(0.96);

  const labelColor: IconColorRole = selected ? 'accent' : 'secondary';
  const iconColor: IconColorRole = selected ? 'accent' : 'muted';

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={event => {
        if (hapticEnabled) {
          haptics.selection();
        }
        onPress?.(event);
      }}
      onPressIn={event => {
        scaleIn();
        onPressIn?.(event);
      }}
      onPressOut={event => {
        scaleOut();
        onPressOut?.(event);
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm - 2,
          minHeight: 36,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accentTint : 'transparent',
          opacity: disabled ? opacityToken.disabled : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      {glyph ? <Icon glyph={glyph} size="xs" color={iconColor} /> : null}
      <Text variant="label" color={labelColor}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}
