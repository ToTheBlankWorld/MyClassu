import React from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../design';

export interface ProgressIndicatorProps {
  /** 0..1 */
  value: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Determinate progress bar. Fill movement is spring-animated on the UI
 * thread; the value is also exposed to screen readers.
 */
export function ProgressIndicator({
  value,
  height = 6,
  style,
  accessibilityLabel,
}: ProgressIndicatorProps) {
  const { colors, radius, spring } = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  const progress = useSharedValue(clamped);

  useEffect(() => {
    progress.value = withSpring(clamped, spring.gentle);
  }, [progress, clamped, spring.gentle]);

  const fillStyle = useAnimatedStyle(() => ({
    flex: progress.value,
  }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          flexDirection: 'row',
          height,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceSunken,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
            minWidth: clamped > 0 ? 8 : 0,
          },
          fillStyle,
        ]}
      />
    </Animated.View>
  );
}
