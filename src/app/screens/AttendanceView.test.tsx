import React from 'react';
import { useColorScheme } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AttendanceView } from './AttendanceView';
import { ThemeProvider } from '../../design';
import { Skeleton } from '../../components';
import type { LocalAttendanceRecord } from '../../features/attendance/attendance';

/** Populated + empty presentation of the Attendance destination. */

const RECORDS: LocalAttendanceRecord[] = [
  {
    id: 'a|2026-10-05',
    sessionId: 'a',
    dateKey: '2026-10-05',
    courseCode: 'MECH3271',
    subject: 'Total Quality Management',
    classStartMillis: 1000,
    classEndMillis: 2000,
    status: 'attended',
    markedAtMillis: 3000,
    updatedAtMillis: 4000,
    synced: false,
  },
  {
    id: 'b|2026-10-06',
    sessionId: 'b',
    dateKey: '2026-10-06',
    courseCode: 'CSEN3141',
    subject: 'Advanced Computer Networks',
    classStartMillis: 1000,
    classEndMillis: 2000,
    status: 'skipped',
    reasonCategory: 'health',
    markedAtMillis: 3000,
    updatedAtMillis: 4000,
    synced: false,
  },
];

const renderView = (ui: React.ReactElement) => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 8, bottom: 0, left: 0, right: 0 },
          frame: { x: 0, y: 0, width: 0, height: 0 },
        }}
      >
        {ui}
      </SafeAreaProvider>,
    );
  });
  return tree;
};

const withProviders = (ui: React.ReactElement) => (
  <ThemeProvider>
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 8, bottom: 0, left: 0, right: 0 },
        frame: { x: 0, y: 0, width: 0, height: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  </ThemeProvider>
);

/** react-test-renderer has no findAllByText — match Text children directly. */
const textsWith = (tree: TestRenderer.ReactTestRenderer, text: string) =>
  tree.root.findAll(node => node.props?.children === text);

describe('AttendanceView — loading', () => {
  it('renders a layout-preserving skeleton, not a blank screen', () => {
    const tree = renderView(
      <AttendanceView
        status="loading"
        records={[]}
        onRetry={() => undefined}
      />,
    );
    expect(
      tree.root
        .findAllByType(Skeleton)
        .filter(node => node.props.accessibilityLabel === 'Loading summary'),
    ).toHaveLength(1);
    expect(
      tree.root
        .findAllByType(Skeleton)
        .filter(node => node.props.accessibilityLabel === 'Loading history'),
    ).toHaveLength(3);
  });
});

describe('AttendanceView — error', () => {
  it('renders a retryable error state and wires the retry action', () => {
    const onRetry = jest.fn();
    const tree = renderView(
      <AttendanceView status="error" records={[]} onRetry={onRetry} />,
    );
    const retryButton = tree.root.findByProps({
      accessibilityLabel: 'Try again',
    });
    act(() => {
      retryButton.props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('AttendanceView — ready (populated)', () => {
  it('shows the summary with percentage and denominator', () => {
    const tree = renderView(
      withProviders(
        <AttendanceView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          'Attendance 50 percent, 1 attended out of 2 decided classes',
      }),
    ).toBeDefined();
    expect(textsWith(tree, '50%').length).toBeGreaterThan(0);
    expect(textsWith(tree, '1 attended · 1 missed').length).toBeGreaterThan(0);
  });

  it('renders history with status and reason context', () => {
    const tree = renderView(
      withProviders(
        <AttendanceView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'Total Quality Management').length).toBeGreaterThan(
      0,
    );
    expect(textsWith(tree, 'Attended').length).toBeGreaterThan(0);
    expect(textsWith(tree, 'Missed').length).toBeGreaterThan(0);
    expect(textsWith(tree, 'Health').length).toBeGreaterThan(0);
  });

  it('filters history through accessible chips', () => {
    const tree = renderView(
      withProviders(
        <AttendanceView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    const missedChip = tree.root.findByProps({
      accessibilityLabel: 'Show missed classes',
    });
    act(() => {
      missedChip.props.onPress();
    });
    expect(textsWith(tree, 'Total Quality Management').length).toBe(0);
    expect(textsWith(tree, 'Missed').length).toBeGreaterThan(0);
  });
});

describe('AttendanceView — ready (empty)', () => {
  it('shows intentional empty states, never NaN or 0%', () => {
    const tree = renderView(
      withProviders(
        <AttendanceView
          status="ready"
          records={[]}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'No attendance yet').length).toBeGreaterThan(0);
    expect(textsWith(tree, '0%').length).toBe(0);
  });
});

describe('AttendanceView — theming', () => {
  afterEach(() => {
    (useColorScheme as jest.Mock).mockReset();
  });

  it('renders in dark mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const tree = renderView(
      withProviders(
        <AttendanceView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, '50%').length).toBeGreaterThan(0);
  });

  it('renders in light mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');
    const tree = renderView(
      withProviders(
        <AttendanceView
          status="ready"
          records={[]}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'No attendance yet').length).toBeGreaterThan(0);
  });
});
