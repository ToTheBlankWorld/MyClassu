import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionEditorScreen } from './SessionEditorScreen';
import { ThemeProvider } from '../../design';
import { __setActiveTimetableForTests } from '../../features/timetable/service/timetableStore';
import { timetable as bundled } from '../../features/timetable/data/timetable';

/** Session editor: validation, overlap warning, add/edit persistence. */

const renderEditor = (params: { sessionId?: string }, goBack: jest.Mock) => {
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
          <SessionEditorScreen
            navigation={{ goBack } as never}
            route={{ params } as never}
          />
        </SafeAreaProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

const textsWith = (tree: TestRenderer.ReactTestRenderer, text: string) =>
  tree.root.findAll(node => node.props?.children === text);

describe('SessionEditorScreen', () => {
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

  it('shows validation errors instead of saving garbage', () => {
    const goBack = jest.fn();
    const tree = renderEditor({}, goBack);
    act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Add class' })
        .props.onPress();
    });
    // No course chosen, no times entered.
    expect(textsWith(tree, 'Choose a valid course.').length).toBeGreaterThan(0);
    expect(goBack).not.toHaveBeenCalled();
  });

  it('warns about overlaps and saves on explicit confirm', async () => {
    const goBack = jest.fn();
    const tree = renderEditor({}, goBack);
    // Monday 10:30–11:30 overlaps the bundled MECH3271 10:00–10:50.
    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'MECH3271' }).props.onPress();
      tree.root
        .findByProps({ placeholder: '14:00' })
        .props.onChangeText('10:30');
      tree.root
        .findByProps({ placeholder: '14:50' })
        .props.onChangeText('11:30');
    });
    const alertSpy = Alert.alert as jest.Mock;
    act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Add class' })
        .props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'Overlapping class',
      expect.stringContaining('Save anyway?'),
      expect.any(Array),
    );
    expect(goBack).not.toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    await act(async () => {
      buttons.find(button => button.text === 'Save anyway')?.onPress?.();
    });
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('saves a valid room-less session without warnings', async () => {
    const goBack = jest.fn();
    const tree = renderEditor({}, goBack);
    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'MECH3271' }).props.onPress();
      tree.root.findByProps({ accessibilityLabel: 'Saturday' }).props.onPress();
      tree.root
        .findByProps({ placeholder: '14:00' })
        .props.onChangeText('09:00');
      tree.root
        .findByProps({ placeholder: '14:50' })
        .props.onChangeText('09:50');
    });
    await act(async () => {
      tree.root
        .findByProps({ accessibilityLabel: 'Add class' })
        .props.onPress();
    });
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('edits the selected session with its values prefilled', () => {
    const target = bundled.sessions[0];
    const tree = renderEditor({ sessionId: target.id }, jest.fn());
    expect(textsWith(tree, 'Edit class').length).toBeGreaterThan(0);
  });
});
