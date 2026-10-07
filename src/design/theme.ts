import { palette } from './tokens/colors';
import { spacing, type SpacingToken } from './tokens/spacing';
import { radius, type RadiusToken } from './tokens/radius';
import { typography, type TypographyVariant } from './tokens/typography';
import { duration, easing, spring } from './tokens/motion';
import { elevation, type ElevationToken } from './tokens/elevation';
import { opacity, type OpacityToken } from './tokens/opacity';
import { zIndex, type ZIndexToken } from './tokens/zIndex';
import { iconSize, type IconSizeToken } from './tokens/iconSize';

/**
 * Semantic theme roles. Components consume ONLY these roles — never raw
 * palette values — so the palette can be finalized later by editing
 * `tokens/colors.ts` + the two role maps below.
 */

export interface ThemeColors {
  /** App background behind all surfaces */
  background: string;
  /** Base content surface (cards, sheets) */
  surface: string;
  /** Raised surface sitting above base (floating elements) */
  surfaceRaised: string;
  /** Sunken/inset surface (wells, track backgrounds) */
  surfaceSunken: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Text/icon color on top of accent */
  textOnAccent: string;
  /** Text/icon color on top of danger fills */
  textOnDanger: string;

  border: string;
  borderStrong: string;

  accent: string;
  accentTint: string;
  accentPressed: string;

  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  danger: string;
  dangerTint: string;

  /** Dimming overlay behind modals */
  scrim: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  duration: typeof duration;
  easing: typeof easing;
  spring: typeof spring;
  elevation: typeof elevation;
  opacity: typeof opacity;
  zIndex: typeof zIndex;
  iconSize: typeof iconSize;
  isDark: boolean;
}

const lightColors: ThemeColors = {
  background: palette.gray25,
  surface: palette.gray0,
  surfaceRaised: palette.gray0,
  surfaceSunken: palette.gray100,
  textPrimary: palette.gray900,
  textSecondary: palette.gray600,
  textMuted: palette.gray400,
  textOnAccent: palette.white,
  textOnDanger: palette.white,
  border: palette.gray200,
  borderStrong: palette.gray300,
  accent: palette.teal600,
  accentTint: 'rgba(46, 139, 127, 0.12)',
  accentPressed: palette.teal700,
  success: palette.green600,
  successTint: 'rgba(62, 155, 95, 0.12)',
  warning: palette.yellow600,
  warningTint: 'rgba(217, 160, 60, 0.14)',
  danger: palette.red600,
  dangerTint: 'rgba(204, 85, 68, 0.12)',
  scrim: 'rgba(11, 10, 8, 0.45)',
};

const darkColors: ThemeColors = {
  background: palette.gray950,
  surface: palette.gray900,
  surfaceRaised: palette.gray800,
  surfaceSunken: palette.gray950,
  textPrimary: palette.gray25,
  textSecondary: palette.gray400,
  textMuted: palette.gray500,
  textOnAccent: palette.gray950,
  textOnDanger: palette.white,
  border: palette.gray700,
  borderStrong: palette.gray600,
  accent: palette.teal400,
  accentTint: 'rgba(111, 199, 188, 0.14)',
  accentPressed: palette.teal300,
  success: palette.green500,
  successTint: 'rgba(62, 155, 95, 0.18)',
  warning: palette.yellow500,
  warningTint: 'rgba(217, 160, 60, 0.18)',
  danger: palette.red500,
  dangerTint: 'rgba(204, 85, 68, 0.18)',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const lightTheme: Theme = {
  colors: lightColors,
  spacing,
  radius,
  typography,
  duration,
  easing,
  spring,
  elevation,
  opacity,
  zIndex,
  iconSize,
  isDark: false,
};

export const darkTheme: Theme = {
  colors: darkColors,
  spacing,
  radius,
  typography,
  duration,
  easing,
  spring,
  elevation,
  opacity,
  zIndex,
  iconSize,
  isDark: true,
};

export type {
  SpacingToken,
  RadiusToken,
  TypographyVariant,
  ElevationToken,
  OpacityToken,
  ZIndexToken,
  IconSizeToken,
};
