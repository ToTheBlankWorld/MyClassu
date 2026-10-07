/** Opacity tokens for interactive-state feedback (never for layout hacks). */
export const opacity = {
  /** Pressed controls */
  pressed: 0.82,
  /** Disabled controls */
  disabled: 0.5,
  /** Decorative watermarks */
  watermark: 0.35,
} as const;

export type OpacityToken = keyof typeof opacity;
