/** Icon sizes. Icons always render at one of these; never arbitrary px. */
export const iconSize = {
  /** Inline with metadata/caption text */
  xs: 14,
  /** Inline with body text, dense controls */
  sm: 18,
  /** Default control icon */
  md: 22,
  /** Large touch targets, feature icons */
  lg: 26,
  /** Hero/empty-state icons */
  xl: 34,
} as const;

export type IconSizeToken = keyof typeof iconSize;
