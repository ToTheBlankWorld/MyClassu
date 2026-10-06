/**
 * Corner radius scale. Components must not invent arbitrary radii.
 */
export const radius = {
  /** 8 — small controls: badges, chips */
  sm: 8,
  /** 12 — buttons, inputs */
  md: 12,
  /** 16 — cards, sheets */
  lg: 16,
  /** 24 — large surfaces, modals */
  xl: 24,
  /** fully round: pills, icon buttons */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
