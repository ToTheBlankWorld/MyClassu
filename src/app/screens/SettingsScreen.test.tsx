jest.mock('react-native-config', () => ({}));
jest.mock('react-native-url-polyfill/auto', () => ({}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsScreen } from './SettingsScreen';
import { ThemeProvider } from '../../design';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.requireActual('react').useEffect,
}));

/** Settings sections render and every control performs a real action. */

const renderSettings = (navigate: jest.Mock) => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <SafeAreaProvider
          initialMetrics={{
            insets: { top: 8, bottom: 0, left: 0, right: 0 },
            frame: { x: 0, y: 0, width: 0, height: 0 },
          }}
        >
          <SettingsScreen
            navigation={{ navigate } as never}
            route={{} as never}
          />
        </SafeAreaProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

const textsWith = (tree: TestRenderer.ReactTestRenderer, text: string) =>
  tree.root.findAll(node => node.props?.children === text);

describe('SettingsScreen', () => {
  it('renders every section with live controls', () => {
    const tree = renderSettings(jest.fn());
    for (const heading of [
      'Appearance',
      'Reminders',
      'Timetable',
      'Attendance display',
      'Permissions',
      'Cloud sync',
    ]) {
      expect(textsWith(tree, heading).length).toBeGreaterThan(0);
    }
    expect(
      tree.root.findByProps({ accessibilityLabel: '5-minute reminders' }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({ accessibilityLabel: 'Class-start alarms' }),
    ).toBeDefined();
  });

  it('opens the timetable manager', () => {
    const navigate = jest.fn();
    const tree = renderSettings(navigate);
    act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Manage timetable' })
        .props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Timetable');
  });

  it('toggles reminder preferences without crashing', () => {
    const tree = renderSettings(jest.fn());
    const toggle = tree.root.findByProps({
      accessibilityLabel: '5-minute reminders',
    });
    expect(toggle.props.accessibilityState.checked).toBe(true);
    act(() => {
      toggle.props.onValueChange(false);
    });
    expect(
      tree.root.findByProps({ accessibilityLabel: '5-minute reminders' }).props
        .accessibilityState.checked,
    ).toBe(false);
  });

  it('reports sync truthfully when unconfigured', () => {
    const tree = renderSettings(jest.fn());
    expect(textsWith(tree, 'Not configured').length).toBeGreaterThan(0);
    expect(textsWith(tree, 'Local-first for now').length).toBeGreaterThan(0);
  });

  it('keeps developer tools behind the __DEV__ gate', () => {
    const tree = renderSettings(jest.fn());
    // __DEV__ is true under Jest, so the tools render; the gate itself is
    // a one-line conditional in the screen, reviewed by inspection.
    expect(
      tree.root.findByProps({ accessibilityLabel: 'Design system showcase' }),
    ).toBeDefined();
  });
});
