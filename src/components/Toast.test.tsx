import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../design';
import { ToastProvider, useToast } from './Toast';

/**
 * Toast lifecycle: appears on demand, carries title/message/tone, honors
 * auto-dismiss timing, and replaces an in-flight toast (latest wins).
 */

jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: () => undefined },
}));

function ToastHarness({
  onReady,
}: {
  onReady: (show: ReturnType<typeof useToast>['showToast']) => void;
}) {
  const { showToast } = useToast();
  onReady(showToast);
  return <Text>harness</Text>;
}

function renderHarness(
  onReady: (show: ReturnType<typeof useToast>['showToast']) => void,
) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider
          initialMetrics={{
            insets: { top: 8, bottom: 0, left: 0, right: 0 },
            frame: { x: 0, y: 0, width: 0, height: 0 },
          }}
        >
          <ThemeProvider>
            <ToastProvider>
              <ToastHarness onReady={onReady} />
            </ToastProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>,
    );
  });
  return tree;
}

// The gesture-handler jest setup wraps our card in a host View that mirrors
// its child's props, so one toast can match twice in tests. We therefore
// assert presence/absence rather than exact counts.
const alertOf = (tree: TestRenderer.ReactTestRenderer, title: string) =>
  tree.root.findAllByProps({ accessibilityLabel: title });

describe('Toast lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the requested toast', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    const tree = renderHarness(s => {
      show = s;
    });
    act(() => {
      show({ title: 'Attendance recorded', message: '10:00', tone: 'success' });
    });
    expect(
      alertOf(tree, 'Attendance recorded. 10:00').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('auto-dismisses after the requested duration', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    const tree = renderHarness(s => {
      show = s;
    });
    act(() => {
      show({ title: 'Temporary', durationMs: 4000 });
    });
    expect(alertOf(tree, 'Temporary').length).toBeGreaterThanOrEqual(1);
    act(() => {
      jest.advanceTimersByTime(4100);
    });
    expect(alertOf(tree, 'Temporary')).toHaveLength(0);
  });

  it('replaces an in-flight toast (latest wins)', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    const tree = renderHarness(s => {
      show = s;
    });
    act(() => {
      show({ title: 'First', durationMs: 4000 });
      show({ title: 'Second', durationMs: 4000 });
    });
    expect(alertOf(tree, 'First')).toHaveLength(0);
    expect(alertOf(tree, 'Second').length).toBeGreaterThanOrEqual(1);
  });
});
