import React from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  AnimatedPressable,
  haptics,
  usePressScale,
  useTheme,
  type IconSizeToken,
} from '../design';

export interface IconButtonProps
  extends Omit<
    React.ComponentProps<typeof AnimatedPressable>,
    'children' | 'style' | 'onPressIn' | 'onPressOut' | 'ref'
  > {
  /** Lucide icon component */
  glyph: LucideIcon;
  /** Accessible name announced by screen readers (required) */
  label: string;
  tone?: 'default' | 'accent' | 'destructive';
  size?: Extract<IconSizeToken, 'sm' | 'md'>;
  /** Haptic tick on press (defaults to on) */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
}

/**
 * Round icon-only control. `label` is mandatory — icon-only controls must
 * always announce themselves. Minimum touch target is generous.
 */
export function IconButton({
  glyph: Glyph,
  label,
  tone = 'default',
  size = 'md',
  haptic = true,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: IconButtonProps) {
  const { colors, iconSize, opacity: opacityToken } = useTheme();
  const {
    animatedStyle,
    onPressIn: scaleIn,
    onPressOut: scaleOut,
  } = usePressScale(0.94);

  const box = size === 'sm' ? 38 : 46;
  const iconToken: IconSizeToken = size === 'sm' ? 'sm' : 'md';

  const foreground =
    tone === 'accent'
      ? colors.accent
      : tone === 'destructive'
      ? colors.danger
      : colors.textSecondary;

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={event => {
        scaleIn();
        if (haptic) {
          haptics.light();
        }
        onPressIn?.(event);
      }}
      onPressOut={event => {
        scaleOut();
        onPressOut?.(event);
      }}
      style={[
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? opacityToken.disabled : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      <Glyph size={iconSize[iconToken]} color={foreground} strokeWidth={2} />
    </AnimatedPressable>
  );
}
