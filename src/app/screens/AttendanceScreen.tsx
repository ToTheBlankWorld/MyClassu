import { AttendanceView } from './AttendanceView';
import { useAttendanceRecords } from '../../features/attendance/useAttendanceRecords';

/**
 * Attendance destination: overview summary plus filterable history, read
 * from the authoritative native store (refreshed on every focus so alarm
 * decisions appear immediately).
 */
export function AttendanceScreen() {
  const { status, records, retry } = useAttendanceRecords();

  return <AttendanceView status={status} records={records} onRetry={retry} />;
}
