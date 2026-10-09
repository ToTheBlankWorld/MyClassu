import { StatsView } from './StatsView';
import { useAttendanceRecords } from '../../features/attendance/useAttendanceRecords';

/**
 * Statistics destination: subject breakdown, reason insights, and weekly
 * trend — all computed from the authoritative native attendance store.
 */
export function StatisticsScreen() {
  const { status, records, retry } = useAttendanceRecords();

  return <StatsView status={status} records={records} onRetry={retry} />;
}
