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

  /** System status-bar background (matches the app background) */
  statusBar: string;
  /** System navigation-bar background (matches the app background) */
  navigationBar: string;
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
  background: palette.surfaceLight,
  surface: palette.surfaceLight,
  surfaceRaised: palette.raisedLight,
  surfaceSunken: palette.sunkenLight,
  textPrimary: palette.ink900,
  textSecondary: palette.slate600,
  textMuted: palette.slate500,
  textOnAccent: palette.white,
  textOnDanger: palette.white,
  border: palette.borderLight,
  borderStrong: palette.borderStrongLight,
  accent: palette.blue500,
  accentTint: 'rgba(37, 99, 235, 0.12)',
  accentPressed: palette.blue600,
  success: palette.green600,
  successTint: 'rgba(62, 155, 95, 0.12)',
  warning: palette.yellow600,
  warningTint: 'rgba(217, 160, 60, 0.14)',
  danger: palette.red600,
  dangerTint: 'rgba(204, 85, 68, 0.12)',
  scrim: 'rgba(0, 0, 0, 0.45)',
  statusBar: palette.surfaceLight,
  navigationBar: palette.surfaceLight,
};

const darkColors: ThemeColors = {
  background: palette.black,
  surface: palette.navySurface,
  surfaceRaised: palette.navyRaised,
  // Distinct from background so wells, tracks and skeletons stay visible
  // when placed directly on it (dark-mode verification finding).
  surfaceSunken: palette.navySunken,
  textPrimary: palette.white,
  textSecondary: palette.slateLight,
  textMuted: palette.slateMutedDark,
  textOnAccent: palette.white,
  textOnDanger: palette.white,
  border: palette.borderDark,
  borderStrong: palette.borderStrongDark,
  accent: palette.blue400,
  accentTint: 'rgba(59, 130, 246, 0.16)',
  accentPressed: palette.blue300,
  success: palette.green500,
  successTint: 'rgba(62, 155, 95, 0.18)',
  warning: palette.yellow500,
  warningTint: 'rgba(217, 160, 60, 0.18)',
  danger: palette.red500,
  dangerTint: 'rgba(204, 85, 68, 0.18)',
  scrim: 'rgba(0, 0, 0, 0.6)',
  statusBar: palette.black,
  navigationBar: palette.black,
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
