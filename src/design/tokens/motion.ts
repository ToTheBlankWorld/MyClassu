import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens. Every animation in MyClassu must justify itself (feedback,
 * continuity, or state change) and must use these durations/curves.
 *
 * Easing comes from react-native-reanimated (NOT react-native): Reanimated
 * requires easing functions passed to `withTiming` to be worklet-safe, and
 * react-native's Easing is plain JS that fails at runtime on device.
 */

export const duration = {
  /** press feedback, state ticks */
  fast: 120,
  /** standard enter/exit, fades */
  base: 200,
  /** modals, sheets, screen-scale transitions */
  slow: 320,
  /** hero/shared-element style movement */
  slower: 480,
} as const;

export const easing = {
  /** decelerate — things entering the screen */
  enter: Easing.out(Easing.cubic),
  /** accelerate — things leaving the screen */
  exit: Easing.in(Easing.cubic),
  /** symmetric small moves */
  standard: Easing.inOut(Easing.cubic),
} as const;

/**
 * Spring configurations for Reanimated `withSpring`: small controls,
 * standard entrances, and playful interruptible handoffs.
 */
export const spring = {
  /** small controls: toggles, chips, badges */
  gentle: { damping: 20, stiffness: 220, mass: 1 },
  /** standard entrances: sheets, toasts */
  snappy: { damping: 18, stiffness: 260, mass: 1 },
  /** playful, interruptible: drag handoffs */
  bouncy: { damping: 14, stiffness: 240, mass: 1 },
} as const;
