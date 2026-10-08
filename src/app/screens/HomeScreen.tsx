import { HomeView } from './HomeView';
import { useNow } from '../../hooks/useNow';
import { useHomeDashboard } from '../../features/timetable/useHomeDashboard';

/**
 * The MyClassu Home dashboard: what day is it, what is happening now, what is
 * next, and how the day looks. Data comes exclusively from the timetable
 * engine through the dashboard selector; `useNow` provides a coarse live
 * clock (30s tick + foreground refresh) so countdowns stay honest without a
 * per-second render loop.
 */
export function HomeScreen() {
  const now = useNow();
  const { status, dashboard, retry } = useHomeDashboard(now);

  return <HomeView status={status} dashboard={dashboard} onRetry={retry} />;
}
