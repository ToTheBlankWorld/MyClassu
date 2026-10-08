import React from 'react';
import { useColorScheme } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeView } from './HomeView';
import { buildHomeDashboard } from '../../features/timetable/dashboard';
import { ThemeProvider } from '../../design';
import { Skeleton } from '../../components';

/**
 * Home presentation behavior across its status machine and the two major
 * hero states, rendered with deterministic dashboard data.
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

describe('HomeView — loading', () => {
  it('renders a layout-preserving skeleton, not a blank screen', () => {
    const tree = renderView(
      <HomeView status="loading" dashboard={null} onRetry={() => undefined} />,
    );
    expect(skeletonsWith(tree, 'Loading your class')).toHaveLength(1);
    expect(skeletonsWith(tree, 'Loading classes')).toHaveLength(3);
  });
});

describe('HomeView — error', () => {
  it('renders a retryable error state and wires the retry action', () => {
    const onRetry = jest.fn();
    const tree = renderView(
      <HomeView status="error" dashboard={null} onRetry={onRetry} />,
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

describe('HomeView — ready (class in progress)', () => {
  const dashboard = buildHomeDashboard(ist(5, 14, 20)); // Monday 14:20

  it('shows the NOW hero with subject, remaining time and progress', () => {
    const tree = renderView(
      withProviders(
        <HomeView
          status="ready"
          dashboard={dashboard}
          onRetry={() => undefined}
        />,
      ),
    );
    const hero = tree.root.findByProps({
      accessibilityLabel:
        'Happening now: Advanced Computer Networks, CSEN3141, until 2:50 PM, room ICT / 606, 30 min remaining',
    });
    expect(hero).toBeDefined();
    expect(
      tree.root.findByProps({
        accessibilityLabel: 'Progress through the class',
      }),
    ).toBeDefined();
    expect(textsWith(tree, '30 min remaining').length).toBeGreaterThan(0);
  });

  it('renders the today timeline with state treatments', () => {
    const tree = renderView(
      withProviders(
        <HomeView
          status="ready"
          dashboard={dashboard}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          'Completed: Total Quality Management, MECH3271, 10:00 AM to 10:50 AM, room ICT / 331',
      }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          'Happening now: Advanced Computer Networks, CSEN3141, 2:00 PM to 2:50 PM, room ICT / 606',
      }),
    ).toBeDefined();
    expect(
      tree.root.findByProps({
        accessibilityLabel:
          'Upcoming: Comprehensive Examination, VIVA3555, 3:00 PM to 3:50 PM, room ICT / 207',
      }),
    ).toBeDefined();
  });

  it('shows the coming-up preview for future days', () => {
    const tree = renderView(
      withProviders(
        <HomeView
          status="ready"
          dashboard={dashboard}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'Tomorrow').length).toBeGreaterThan(0);
  });
});

describe('HomeView — ready (free day)', () => {
  const dashboard = buildHomeDashboard(ist(10, 12, 0)); // Saturday

  it('shows an intentional empty state pointing at the next class', () => {
    const tree = renderView(
      withProviders(
        <HomeView
          status="ready"
          dashboard={dashboard}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(textsWith(tree, 'A free day').length).toBeGreaterThan(0);
    expect(textsWith(tree, 'No classes today').length).toBeGreaterThan(0);
    expect(
      textsWith(tree, 'Your next class is Monday at 10:00 AM.').length,
    ).toBeGreaterThan(0);
  });
});

describe('HomeView — theming', () => {
  afterEach(() => {
    (useColorScheme as jest.Mock).mockReset();
  });

  it('renders in dark mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const dashboard = buildHomeDashboard(ist(5, 14, 20));
    const tree = renderView(
      withProviders(
        <HomeView
          status="ready"
          dashboard={dashboard}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel: 'Progress through the class',
      }),
    ).toBeDefined();
  });

  it('renders in light mode', () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');
    const dashboard = buildHomeDashboard(ist(5, 14, 20));
    const tree = renderView(
      withProviders(
        <HomeView
          status="ready"
          dashboard={dashboard}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(
      tree.root.findByProps({
        accessibilityLabel: 'Progress through the class',
      }),
    ).toBeDefined();
  });
});
