import type { TextStyle } from 'react-native';

/**
 * Typography hierarchy. Text roles map onto these definitions; components must
 * use variants (see `components/Text.tsx`), never raw font sizes.
 *
 * Stage 0 uses the platform default font family. Custom fonts, if adopted
 * later, plug in here without touching any component.
 */

export const fontFamilies = {
  regular: undefined as TextStyle['fontFamily'],
  emphasized: undefined as TextStyle['fontFamily'],
  numeric: undefined as TextStyle['fontFamily'],
};

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: 0,
  },
  headingLarge: {
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '700',
    letterSpacing: 0,
  },
  heading: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: 0,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  metadata: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
