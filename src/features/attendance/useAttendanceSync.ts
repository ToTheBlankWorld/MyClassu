import { useEffect } from 'react';
import { syncPendingAttendance } from './attendanceSync';

/**
 * Best-effort outbox flush on app start. Silent by design: sync must never
 * break launch, and an empty/unconfigured backend simply defers.
 */
export function useAttendanceSync(): void {
  useEffect(() => {
    let cancelled = false;
    const flush = async () => {
      try {
        await syncPendingAttendance();
      } catch {
        // Never surfaces: the outbox waits for the next launch.
      }
      if (cancelled) {
        return;
      }
    };
    flush();
    return () => {
      cancelled = true;
    };
  }, []);
}
