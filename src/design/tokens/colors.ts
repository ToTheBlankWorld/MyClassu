/**
 * Raw color primitives for MyClassu.
 *
 * Two polished themes share one blue identity:
 * - Dark: true AMOLED black with modern blue accents.
 * - Light: clean white with the same blue accents.
 *
 * Components must only ever consume semantic tokens (see `theme.ts`),
 * never these raw values.
 *
 * Guidance:
 * - one restrained blue accent (no gradients, no purple/blue AI clichés)
 * - cool slate neutrals; dark surfaces stay near-black for AMOLED depth
 * - tints are accent/success/warning/danger at low alpha for soft backgrounds
 */

export const palette = {
  // Absolute grounds
  black: '#000000',
  white: '#FFFFFF',

  // Dark surfaces (near-black navy, keep AMOLED depth)
  navySurface: '#080B12',
  navyRaised: '#0D1320',
  navySunken: '#111A2B',
  navyTint: '#0B1B33',

  // Dark text + borders
  slateLight: '#B8C4D6',
  slateMutedDark: '#7D8BA0',
  borderDark: '#1C2738',
  borderStrongDark: '#2A3B55',

  // Light surfaces
  surfaceLight: '#FFFFFF',
  raisedLight: '#F8FAFC',
  sunkenLight: '#F1F5F9',
  blueTintLight: '#EFF6FF',

  // Light text + borders
  ink900: '#0F172A',
  slate600: '#475569',
  slate500: '#64748B',
  borderLight: '#E2E8F0',
  borderStrongLight: '#CBD5E1',

  // Primary accent — "signal" (modern blue)
  blue300: '#60A5FA',
  blue400: '#3B82F6',
  blue500: '#2563EB',
  blue600: '#1D4ED8',

  // Status (kept distinct + accessible on both black and white)
  green500: '#3E9B5F',
  green600: '#2F7C4A',
  yellow500: '#D9A03C',
  yellow600: '#B27F27',
  red500: '#CC5544',
  red600: '#A93F31',

  // Overlays
  scrim: '#000000',
} as const;
