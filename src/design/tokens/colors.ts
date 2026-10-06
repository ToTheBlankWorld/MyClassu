/**
 * Raw color primitives for MyClassu.
 *
 * Stage 0: colors are intentionally *placeholders* arranged in semantic roles.
 * The palette will be finalized in the design stage; components must only ever
 * consume semantic tokens (see `theme.ts`), never these raw values.
 *
 * Guidance for the final palette:
 * - one restrained accent (no gradients, no purple/blue AI clichés)
 * - warm neutrals over cold grays for a calmer, more personal feel
 * - tints are accent/success/warning/danger at low alpha for soft backgrounds
 */

export const palette = {
  // Neutrals (warm)
  gray0: '#FFFFFF',
  gray25: '#FBFAF8',
  gray50: '#F5F3F0',
  gray100: '#ECE9E4',
  gray200: '#DDD9D2',
  gray300: '#C5C0B7',
  gray400: '#A19A8F',
  gray500: '#7D766C',
  gray600: '#5C564E',
  gray700: '#423D37',
  gray800: '#2B2823',
  gray900: '#1B1915',
  gray950: '#121110',

  // Primary accent — "lagoon" (deep teal)
  teal300: '#6FC7BC',
  teal400: '#45AFA2',
  teal500: '#2E8B7F',
  teal600: '#247067',
  teal700: '#1C5850',

  // Secondary accent — "amber"
  amber300: '#F5C877',
  amber400: '#E8A94A',
  amber500: '#C9862B',
  amber600: '#A56B20',

  // Status
  green500: '#3E9B5F',
  green600: '#2F7C4A',
  yellow500: '#D9A03C',
  yellow600: '#B27F27',
  red500: '#CC5544',
  red600: '#A93F31',

  // Overlays
  scrim: '#0B0A08',
  white: '#FFFFFF',
} as const;
