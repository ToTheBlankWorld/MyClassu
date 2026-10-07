import React from 'react';
import {
  ActivityIndicator,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AnimatedPressable, haptics, usePressScale, useTheme } from '../design';
import { Text } from './Text';

export interface ButtonProps
  extends Omit<
    React.ComponentProps<typeof AnimatedPressable>,
    'children' | 'style' | 'onPressIn' | 'onPressOut' | 'ref'
  > {
  /** Visual weight of the button */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  size?: 'sm' | 'md';
  /** Stretch to fill the parent width */
  block?: boolean;
  /** Shows a spinner and blocks interaction; keeps the label's width */
  loading?: boolean;
  /** Haptic tick on press (defaults to on) */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  children: string;
}

interface VariantStyle {
  background: string;
  label: string;
}

/**
 * The app's text button. Press feedback = spring scale + opacity + a light
 * haptic; the layout is stable while loading so the button never jumps.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  haptic = true,
  disabled,
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const { colors, spacing, radius, opacity: opacityToken } = useTheme();
  const {
    animatedStyle,
    onPressIn: scaleIn,
    onPressOut: scaleOut,
  } = usePressScale(0.98);

  const isDisabled = disabled === true || loading;

  const paddings =
    size === 'sm'
      ? { paddingHorizontal: spacing.lg, minHeight: 38 }
      : { paddingHorizontal: spacing.xl, minHeight: 48 };

  const variants: Record<NonNullable<ButtonProps['variant']>, VariantStyle> = {
    primary: { background: colors.accent, label: colors.textOnAccent },
    secondary: { background: colors.surfaceSunken, label: colors.textPrimary },
    tertiary: { background: 'transparent', label: colors.accent },
    destructive: { background: colors.danger, label: colors.textOnDanger },
  };
  const { background, label } = variants[variant];

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={children}
      disabled={isDisabled}
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
          ...paddings,
          backgroundColor: background,
          borderRadius: radius.md,
          alignSelf: block ? 'stretch' : 'flex-start',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? opacityToken.disabled : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      <View>
        <Text
          variant="label"
          style={{
            color: label,
            textAlign: 'center',
            opacity: loading ? 0 : 1,
          }}
        >
          {children}
        </Text>
        {loading ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator size="small" color={label} />
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}
