import { darkTheme, lightTheme } from './theme';
import { elevation } from './tokens/elevation';
import { iconSize } from './tokens/iconSize';
import { duration, easing, spring } from './tokens/motion';
import { opacity } from './tokens/opacity';
import { radius } from './tokens/radius';
import { spacing } from './tokens/spacing';
import { typography } from './tokens/typography';
import { zIndex } from './tokens/zIndex';

/**
 * Token availability: the design system's promise is that every visual
 * decision resolves through tokens. These tests pin the contract — if a
 * token group or semantic role goes missing, components silently lose their
 * theme, so we fail loudly instead.
 */

const COLOR_ROLES = Object.keys(lightTheme.colors) as Array<
  keyof typeof lightTheme.colors
>;

describe('design tokens', () => {
  it('exposes every semantic color role in BOTH themes', () => {
    expect(COLOR_ROLES.length).toBeGreaterThanOrEqual(16);
    for (const role of COLOR_ROLES) {
      expect(typeof lightTheme.colors[role]).toBe('string');
      expect(typeof darkTheme.colors[role]).toBe('string');
      expect(lightTheme.colors[role].length).toBeGreaterThan(0);
      expect(darkTheme.colors[role].length).toBeGreaterThan(0);
    }
  });

  it('keeps light and dark themes structurally identical', () => {
    expect(Object.keys(lightTheme.colors).sort()).toEqual(
      Object.keys(darkTheme.colors).sort(),
    );
  });

  it('themes report their mode', () => {
    expect(lightTheme.isDark).toBe(false);
    expect(darkTheme.isDark).toBe(true);
  });

  it('provides the full spacing scale', () => {
    expect(Object.keys(spacing).sort()).toEqual([
      'lg',
      'md',
      'sm',
      'xl',
      'xs',
      'xxl',
      'xxxl',
    ]);
  });

  it('provides the radius scale', () => {
    expect(Object.keys(radius).sort()).toEqual([
      'lg',
      'md',
      'pill',
      'sm',
      'xl',
    ]);
  });

  it('provides the full typography hierarchy (9 roles)', () => {
    expect(Object.keys(typography).sort()).toEqual(
      [
        'body',
        'bodySmall',
        'caption',
        'display',
        'heading',
        'headingLarge',
        'label',
        'metadata',
        'title',
      ].sort(),
    );
    for (const variant of Object.values(typography)) {
      expect(variant.fontSize).toBeGreaterThan(0);
      expect(variant.lineHeight).toBeGreaterThanOrEqual(variant.fontSize);
    }
  });

  it('provides motion tokens (durations, easings, springs)', () => {
    expect(Object.keys(duration).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(easing).sort()).toEqual(['enter', 'exit', 'standard']);
    expect(Object.keys(spring).sort()).toEqual(['bouncy', 'gentle', 'snappy']);
    for (const config of Object.values(spring)) {
      expect(config.damping).toBeGreaterThan(0);
      expect(config.stiffness).toBeGreaterThan(0);
    }
  });

  it('provides elevation, opacity, z-index and icon-size scales', () => {
    expect(Object.keys(elevation).sort()).toEqual([
      'level0',
      'level1',
      'level2',
      'level3',
    ]);
    expect(Object.keys(opacity).sort()).toEqual([
      'disabled',
      'pressed',
      'watermark',
    ]);
    expect(Object.keys(zIndex).sort()).toEqual([
      'base',
      'overlay',
      'sticky',
      'toast',
    ]);
    expect(Object.keys(iconSize).sort()).toEqual([
      'lg',
      'md',
      'sm',
      'xl',
      'xs',
    ]);
  });
});
