import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';

/**
 * Press feedback: a small spring-driven scale plus a quick opacity dip while
 * the finger is down. Centralizes the "tactile press" behavior so every
 * touchable feels identical. Respects reduced motion. Use with
 * `AnimatedPressable` and a PLAIN style array (animated styles cannot be
 * nested inside RN style *functions*).
 */
export function usePressScale(scale = 0.97): {
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  onPressIn: () => void;
  onPressOut: () => void;
} {
  const { spring, opacity: opacityToken, duration } = useTheme();
  const pressed = useSharedValue(false);
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          scale: withSpring(
            pressed.value && !reducedMotion ? scale : 1,
            spring.gentle,
          ),
        },
      ],
      opacity: withTiming(pressed.value ? opacityToken.pressed : 1, {
        duration: duration.fast,
      }),
    }),
    [
      pressed,
      reducedMotion,
      scale,
      spring.gentle,
      opacityToken.pressed,
      duration.fast,
    ],
  );

  return {
    animatedStyle,
    onPressIn: () => {
      pressed.value = true;
    },
    onPressOut: () => {
      pressed.value = false;
    },
  };
}

/** Pressable that accepts Reanimated animated styles in its style array. */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
