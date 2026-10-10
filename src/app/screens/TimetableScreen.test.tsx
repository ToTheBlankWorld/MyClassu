import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TimetableScreen } from './TimetableScreen';
import { ThemeProvider } from '../../design';
import {
  __setActiveTimetableForTests,
  getActiveTimetable,
} from '../../features/timetable/service/timetableStore';
import { timetable as bundled } from '../../features/timetable/data/timetable';

/** Timetable manager: grouped list, edit navigation, confirmed delete. */

const renderTimetable = (navigate: jest.Mock) => {
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
          <TimetableScreen
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

describe('TimetableScreen', () => {
  beforeEach(() => {
    act(() => {
      __setActiveTimetableForTests(bundled);
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    act(() => {
      __setActiveTimetableForTests(bundled);
    });
  });

  it('lists sessions grouped Monday-first with counts', () => {
    const tree = renderTimetable(jest.fn());
    expect(textsWith(tree, 'Monday').length).toBeGreaterThan(0);
    expect(textsWith(tree, 'Sunday').length).toBeGreaterThan(0);
    expect(textsWith(tree, 'Total Quality Management').length).toBeGreaterThan(
      0,
    );
    expect(textsWith(tree, '4 classes').length).toBeGreaterThan(0);
  });

  it('navigates to the editor for add and edit', () => {
    const navigate = jest.fn();
    const tree = renderTimetable(navigate);
    act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Add a class' })
        .props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('SessionEditor', {});
    act(() => {
      tree.root
        .findAllByProps({ accessibilityLabel: 'Edit' })[0]
        .props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith(
      'SessionEditor',
      expect.objectContaining({ sessionId: expect.any(String) }),
    );
  });

  it('confirms before deleting and removes only that session', async () => {
    const tree = renderTimetable(jest.fn());
    const alertSpy = Alert.alert as jest.Mock;
    const before = tree.root.findAllByProps({
      accessibilityLabel: 'Edit',
    }).length;
    const deleteButton = tree.root
      .findAllByProps({ accessibilityRole: 'button' })
      .find(
        node =>
          typeof node.props.accessibilityLabel === 'string' &&
          (node.props.accessibilityLabel as string).startsWith('Delete '),
      );
    expect(deleteButton).toBeDefined();
    act(() => {
      deleteButton?.props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete this class?',
      expect.stringContaining('Past attendance records are kept.'),
      expect.any(Array),
    );
    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    expect(buttons.map(button => button.text)).toEqual(['Keep it', 'Delete']);
    // Confirming deletes exactly one session; courses are untouched.
    // (Each visible button matches several tree nodes, so assert the
    // rendered count drops alongside the exact store-level count.)
    await act(async () => {
      buttons.find(button => button.text === 'Delete')?.onPress?.();
    });
    expect(
      tree.root.findAllByProps({ accessibilityLabel: 'Edit' }).length,
    ).toBeLessThan(before);
    expect(getActiveTimetable().sessions).toHaveLength(
      bundled.sessions.length - 1,
    );
    expect(getActiveTimetable().courses).toHaveLength(bundled.courses.length);
  });
});
