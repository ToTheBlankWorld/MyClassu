import React from 'react';
import { useColorScheme } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScheduleView } from './ScheduleView';
import { buildScheduleView } from '../../features/timetable/schedule';
import type { ScheduleActions } from '../../features/timetable/useSchedule';
import { ThemeProvider } from '../../design';
import { Skeleton } from '../../components';

/**
 * Schedule presentation behavior across its status machine, day selection,
 * and timeline states, rendered with deterministic selector data.
 */

const ist = (d: number, hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 9, d, hours - 5, minutes - 30));

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

const skeletonsWith = (tree: TestRenderer.ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(Skeleton)
    .filter(node => node.props.accessibilityLabel === label);

const stubActions = (): ScheduleActions & {
  selectDay: jest.Mock;
  previousWeek: jest.Mock;
  nextWeek: jest.Mock;
  goToToday: jest.Mock;
} => ({
  selectDay: jest.fn(),
  previousWeek: jest.fn(),
  nextWeek: jest.fn(),
  goToToday: jest.fn(),
});

describe('ScheduleView — loading', () => {
  it('renders a layout-preserving skeleton, not a blank screen', () => {
    const tree = renderView(
      <ScheduleView
        status="loading"
        view={null}
        actions={stubActions()}
        onRetry={() => undefined}
      />,
    );
    expect(skeletonsWith(tree, 'Loading week')).toHaveLength(1);
    expect(skeletonsWith(tree, 'Loading day')).toHaveLength(7);
    expect(skeletonsWith(tree, 'Loading classes')).toHaveLength(3);
  });
});

describe('ScheduleView — error', () => {
  it('renders a retryable error state and wires the retry action', () => {
    const onRetry = jest.fn();
    const tree = renderView(
      <ScheduleView
        status="error"
        view={null}
        actions={stubActions()}
        onRetry={onRetry}
      />,
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

describe('ScheduleView — ready (today with a running class)', () => {
  // Monday 14:20 — CSEN3141 is running.
  const view = buildScheduleView(ist(5, 14, 20), '2026-10-05');

  it('shows the week strip with an announced today selection', () => {
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={stubActions()}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'Oct 5 – Oct 11').length).toBeGreaterThan(0);
    expect(
      tree.root.findByProps({
        accessibilityLabel: 'Monday, Oct 5, selected, today, 4 classes',
      }),
    ).toBeDefined();
    expect(textsWith(tree, 'Today').length).toBeGreaterThan(0);
    expect(
      textsWith(tree, '4 classes · 10:00 AM – 3:50 PM').length,
    ).toBeGreaterThan(0);
  });

  it('renders the timeline with state summaries and durations', () => {
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={stubActions()}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          'Total Quality Management, 10:00 AM to 10:50 AM, ICT / 331, Battula Suryanarayana Murthy, completed',
      }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          'Advanced Computer Networks, 2:00 PM to 2:50 PM, ICT / 606, Tadi Srinivas, happening now',
      }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        accessibilityLabel: 'Progress through the class',
      }),
    ).toBeDefined();
    expect(textsWith(tree, '· 50 min').length).toBeGreaterThan(0);
  });

  it('hides the Today button when the selection is today', () => {
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={stubActions()}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findAll(node => node.props?.accessibilityLabel === 'Today'),
    ).toHaveLength(0);
  });
});

describe('ScheduleView — ready (empty Saturday)', () => {
  const view = buildScheduleView(ist(10, 12, 0), '2026-10-10');

  it('shows an intentional empty state pointing at Monday', () => {
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={stubActions()}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'No classes today').length).toBeGreaterThan(0);
    expect(
      textsWith(tree, 'Your next class is Monday at 10:00 AM.').length,
    ).toBeGreaterThan(0);
  });
});

describe('ScheduleView — ready (selected future day)', () => {
  // Saturday noon, Sunday selected → "Tomorrow" with a Today button.
  const view = buildScheduleView(ist(10, 12, 0), '2026-10-11');

  it('offers a return-to-today action and announces the selection', () => {
    const actions = stubActions();
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={actions}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'Tomorrow').length).toBeGreaterThan(0);
    const todayButton = tree.root.findByProps({
      accessibilityLabel: 'Today',
    });
    act(() => {
      todayButton.props.onPress();
    });
    expect(actions.goToToday).toHaveBeenCalledTimes(1);
  });
});

describe('ScheduleView — interactions', () => {
  const view = buildScheduleView(ist(5, 14, 20), '2026-10-05');

  it('selects a day through its announced radio cell', () => {
    const actions = stubActions();
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={actions}
          onRetry={() => undefined}
        />,
      ),
    );
    const tuesday = tree.root.findByProps({
      accessibilityLabel: 'Tuesday, Oct 6, 3 classes',
    });
    act(() => {
      tuesday.props.onPress();
    });
    expect(actions.selectDay).toHaveBeenCalledWith('2026-10-06');
  });

  it('navigates weeks through the chevron controls', () => {
    const actions = stubActions();
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={actions}
          onRetry={() => undefined}
        />,
      ),
    );
    act(() => {
      tree.root
        .findByProps({ accessibilityLabel: 'Previous week' })
        .props.onPress();
      tree.root
        .findByProps({ accessibilityLabel: 'Next week' })
        .props.onPress();
    });
    expect(actions.previousWeek).toHaveBeenCalledTimes(1);
    expect(actions.nextWeek).toHaveBeenCalledTimes(1);
  });
});

describe('ScheduleView — theming', () => {
  afterEach(() => {
    (useColorScheme as jest.Mock).mockReset();
  });

  it('renders in dark mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const view = buildScheduleView(ist(5, 14, 20), '2026-10-05');
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={stubActions()}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel: 'Monday, Oct 5, selected, today, 4 classes',
      }),
    ).toBeDefined();
  });

  it('renders in light mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');
    const view = buildScheduleView(ist(5, 14, 20), '2026-10-05');
    const tree = renderView(
      withProviders(
        <ScheduleView
          status="ready"
          view={view}
          actions={stubActions()}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'Oct 5 – Oct 11').length).toBeGreaterThan(0);
  });
});
