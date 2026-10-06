import { Easing } from 'react-native';

/**
 * Motion tokens. Every animation in MyClassu must justify itself (feedback,
 * continuity, or state change) and must use these durations/curves.
 *
 * Springs are preferred for interruptible, gesture-driven motion (Reanimated
 * arrives in the motion stage); duration/curve tokens cover simple
 * enter/exit/feedback transitions in the meantime.
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
 * Reference spring configurations (Reanimated `withSpring` configs, kept
 * symbolic until the motion stage wires Reanimated in).
 */
export const spring = {
  /** small controls: toggles, chips, badges */
  gentle: { damping: 20, stiffness: 220, mass: 1 },
  /** standard entrances: sheets, toasts */
  snappy: { damping: 18, stiffness: 260, mass: 1 },
  /** playful, interruptible: drag handoffs */
  bouncy: { damping: 14, stiffness: 240, mass: 1 },
} as const;
