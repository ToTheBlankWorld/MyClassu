import type { ViewStyle } from 'react-native';

/**
 * Elevation tokens. Shadows are used sparingly — only for elements that
 * genuinely float above content (toasts, sheets, floating controls).
 * In-app cards rely on surface color + hairline borders, not shadows.
 *
 * iOS uses shadow* props; Android uses the `elevation` integer (which also
 * drives some component behaviors). Keep both in sync per level.
 */

export const elevation = {
  /** Resting content — no shadow. */
  level0: {} as ViewStyle,
  /** Slightly raised: pressed surfaces, sticky bars. */
  level1: {
    shadowColor: '#0B0A08',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  } as ViewStyle,
  /** Floating above content: toasts, menus. */
  level2: {
    shadowColor: '#0B0A08',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  } as ViewStyle,
  /** Top of the world: modals, sheets. */
  level3: {
    shadowColor: '#0B0A08',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  } as ViewStyle,
};

export type ElevationToken = keyof typeof elevation;
