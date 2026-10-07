import React, { useEffect } from 'react';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import type { ViewProps } from 'react-native';
import { useTheme } from '../ThemeProvider';

export interface EntranceProps extends ViewProps {
  children: React.ReactNode;
  /** Delay before the entrance begins (ms) — use for gentle list staggering */
  delay?: number;
  /** Travel distance in dp (capped small; entrances are subtle) */
  distance?: number;
  from?: 'top' | 'bottom' | 'start' | 'end' | 'none';
}

/**
 * One-shot entrance: fade + small directional travel with a spring settle.
 * Used where an element appears due to navigation or state change — never
 * decoratively. With reduced motion enabled the content appears in place.
 */
export function Entrance({
  children,
  delay = 0,
  distance = 10,
  from = 'bottom',
  style,
  ...rest
}: EntranceProps) {
  const { spring } = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(delay, withSpring(1, spring.snappy));
  }, [progress, reducedMotion, delay, spring.snappy]);

  const amount = from === 'none' ? 0 : distance;
  const axisX = from === 'start' ? -amount : from === 'end' ? amount : 0;
  const axisY = from === 'top' ? -amount : from === 'bottom' ? amount : 0;

  const animatedStyle = useAnimatedStyle(
    () => ({
      opacity: progress.value,
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [axisX, 0]) },
        { translateY: interpolate(progress.value, [0, 1], [axisY, 0]) },
      ],
    }),
    [axisX, axisY],
  );

  return (
    <Animated.View {...rest} style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}
