import React from 'react';
import {
  Pressable,
  Text as RNText,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../design';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  /** Single-character glyph or symbol rendered inside the button */
  glyph: string;
  /** Accessible name announced by screen readers */
  label: string;
  tone?: 'default' | 'accent';
  style?: StyleProp<ViewStyle>;
}

/**
 * Circular icon button. Stage 0 renders a text glyph; a proper icon set slots
 * in here later without changing the call sites.
 */
export function IconButton({
  glyph,
  label,
  tone = 'default',
  disabled,
  style,
  ...rest
}: IconButtonProps) {
  const { colors, spacing, radius } = useTheme();

  const foreground = tone === 'accent' ? colors.accent : colors.textSecondary;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.surfaceSunken : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <RNText
        style={{
          fontSize: 18,
          lineHeight: 24,
          color: foreground,
          padding: spacing.xs,
        }}
      >
        {glyph}
      </RNText>
    </Pressable>
  );
}
