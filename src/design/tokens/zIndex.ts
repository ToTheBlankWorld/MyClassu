/** Stacking order. Only these values; never ad-hoc z-indexes. */
export const zIndex = {
  base: 0,
  /** Sticky bars, tab bar */
  sticky: 10,
  /** Overlays: scrims, sheets */
  overlay: 50,
  /** Toasts — always visible */
  toast: 100,
} as const;

export type ZIndexToken = keyof typeof zIndex;
