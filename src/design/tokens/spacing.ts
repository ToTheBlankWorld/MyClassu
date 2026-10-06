/**
 * Spacing scale. All layout spacing in the app must come from these tokens —
 * no magic margins or paddings in components.
 */
export const spacing = {
  /** 4 — hairline breathing room, icon gaps */
  xs: 4,
  /** 8 — intra-component gaps */
  sm: 8,
  /** 12 — compact component padding */
  md: 12,
  /** 16 — default component padding, list gaps */
  lg: 16,
  /** 24 — screen gutters, section separation */
  xl: 24,
  /** 32 — large section separation */
  xxl: 32,
  /** 48 — hero spacing */
  xxxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;
