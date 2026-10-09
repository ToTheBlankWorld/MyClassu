import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getAttendanceRecords } from './attendanceBridge';
import type { LocalAttendanceRecord } from './attendance';

/**
 * Attendance records for analytics screens. Reads the authoritative native
 * store on mount and on every screen focus (so alarm decisions made while
 * the app was backgrounded appear immediately). Offline-first: an absent
 * bridge simply yields an empty list, never an error.
 */
export type AttendanceRecordsStatus = 'loading' | 'ready' | 'error';

export interface UseAttendanceRecordsResult {
  status: AttendanceRecordsStatus;
  records: LocalAttendanceRecord[];
  retry: () => void;
}

export function useAttendanceRecords(): UseAttendanceRecordsResult {
  const [status, setStatus] = useState<AttendanceRecordsStatus>('loading');
  const [records, setRecords] = useState<LocalAttendanceRecord[]>([]);

  const load = useCallback(async () => {
    try {
      setRecords(await getAttendanceRecords());
      setStatus('ready');
    } catch {
      setRecords([]);
      setStatus('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const retry = useCallback(() => {
    setStatus('loading');
    load();
  }, [load]);

  return { status, records, retry };
}
