import { TAB_DESTINATIONS } from './types';

/**
 * Primary navigation contract: five destinations, unique names and labels,
 * each with an icon for the compact tab bar.
 */

describe('primary navigation destinations', () => {
  it('defines the five product destinations', () => {
    expect(TAB_DESTINATIONS.map(destination => destination.name)).toEqual([
      'Home',
      'Schedule',
      'Attendance',
      'Statistics',
      'Settings',
    ]);
  });

  it('gives every destination a non-empty label and icon', () => {
    for (const destination of TAB_DESTINATIONS) {
      expect(destination.label.length).toBeGreaterThan(0);
      expect(destination.icon).toBeDefined();
    }
  });

  it('keeps labels short enough for the compact tab bar', () => {
    for (const destination of TAB_DESTINATIONS) {
      expect(destination.label.length).toBeLessThanOrEqual(10);
    }
  });
});
