import React, { useEffect } from 'react';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme, type RadiusToken } from '../design';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: RadiusToken;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Calm loading placeholder. A gentle opacity pulse — no sliding gradients,
 * no spinners in lists. Freezes (fully visible, dimmed) under reduced motion.
 * Pair with accessibilityLabel so screen readers know what is loading.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'md',
  style,
  accessibilityLabel,
}: SkeletonProps) {
  const { colors, radius: radiusToken, duration, easing } = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0.5;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: duration.slow * 3, easing: easing.standard }),
      -1,
      true,
    );
  }, [progress, reducedMotion, duration.slow, easing.standard]);

  const animatedStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(progress.value, [0, 1], [0.45, 0.9]),
    }),
    [],
  );

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Loading'}
      style={[
        {
          width,
          height,
          borderRadius: radiusToken[radius],
          backgroundColor: colors.surfaceSunken,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
