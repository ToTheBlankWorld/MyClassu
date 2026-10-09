import React from 'react';
import { useColorScheme } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatsView } from './StatsView';
import { ThemeProvider } from '../../design';
import { Skeleton } from '../../components';
import type { LocalAttendanceRecord } from '../../features/attendance/attendance';

/** Populated + empty presentation of the Stats destination. */

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
  {
    id: 'c|2026-10-07',
    sessionId: 'c',
    dateKey: '2026-10-07',
    courseCode: 'CSEN3141',
    subject: 'Advanced Computer Networks',
    classStartMillis: 1000,
    classEndMillis: 2000,
    status: 'skipped',
    reasonCategory: 'other',
    reasonText: 'Bus broke down',
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

describe('StatsView — loading', () => {
  it('renders a layout-preserving skeleton, not a blank screen', () => {
    const tree = renderView(
      <StatsView status="loading" records={[]} onRetry={() => undefined} />,
    );
    expect(
      tree.root
        .findAllByType(Skeleton)
        .filter(node => node.props.accessibilityLabel === 'Loading summary'),
    ).toHaveLength(1);
    expect(
      tree.root
        .findAllByType(Skeleton)
        .filter(node => node.props.accessibilityLabel === 'Loading trend'),
    ).toHaveLength(1);
  });
});

describe('StatsView — error', () => {
  it('renders a retryable error state and wires the retry action', () => {
    const onRetry = jest.fn();
    const tree = renderView(
      <StatsView status="error" records={[]} onRetry={onRetry} />,
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

describe('StatsView — ready (populated)', () => {
  it('shows the summary with a consistent denominator', () => {
    const tree = renderView(
      withProviders(
        <StatsView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          'Attendance 33 percent, 1 attended out of 3 decided classes',
      }),
    ).toBeDefined();
  });

  it('breaks attendance down by subject with progress', () => {
    const tree = renderView(
      withProviders(
        <StatsView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'Total Quality Management').length).toBeGreaterThan(
      0,
    );
    expect(
      textsWith(tree, 'Advanced Computer Networks').length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findByProps({
        accessibilityLabel: 'Attendance for CSEN3141: 0 percent',
      }),
    ).toBeDefined();
  });

  it('explains missed classes by reason with shares', () => {
    const tree = renderView(
      withProviders(
        <StatsView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel: '1 missed for Health, 50 percent of missed',
      }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        accessibilityLabel: '1 missed for Other, 50 percent of missed',
      }),
    ).toBeDefined();
  });

  it('renders the weekly trend with an accessible chart summary', () => {
    const tree = renderView(
      withProviders(
        <StatsView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findAll(
        node =>
          typeof node.props?.accessibilityLabel === 'string' &&
          (node.props.accessibilityLabel as string).startsWith('Week of '),
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('StatsView — ready (empty)', () => {
  it('shows intentional empty states, never a misleading chart', () => {
    const tree = renderView(
      withProviders(
        <StatsView status="ready" records={[]} onRetry={() => undefined} />,
      ),
    );
    expect(textsWith(tree, 'No attendance yet').length).toBeGreaterThan(0);
    expect(textsWith(tree, 'No subjects yet').length).toBeGreaterThan(0);
    expect(textsWith(tree, 'Nothing missed').length).toBeGreaterThan(0);
    expect(
      textsWith(
        tree,
        'Mark classes from the class-start alarm and your weekly trend will grow here.',
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe('StatsView — theming', () => {
  afterEach(() => {
    (useColorScheme as jest.Mock).mockReset();
  });

  it('renders in dark mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const tree = renderView(
      withProviders(
        <StatsView
          status="ready"
          records={RECORDS}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          'Attendance 33 percent, 1 attended out of 3 decided classes',
      }),
    ).toBeDefined();
  });

  it('renders in light mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');
    const tree = renderView(
      withProviders(
        <StatsView status="ready" records={[]} onRetry={() => undefined} />,
      ),
    );
    expect(textsWith(tree, 'No subjects yet').length).toBeGreaterThan(0);
  });
});
