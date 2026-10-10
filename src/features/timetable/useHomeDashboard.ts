import { useCallback, useEffect, useState } from 'react';
import type { HomeDashboard } from './dashboard';
import { buildHomeDashboard } from './dashboard';
import { useActiveTimetable } from './service/timetableStore';

/**
 * Home screen data container: drives the pure dashboard selector from a live
 * `now` instant over the ACTIVE timetable (bundled seed until user edits
 * hydrate) and exposes a status machine for the screen's loading, ready
 * and error presentations. Supabase is never involved.
 */

export interface HomeDashboardResult {
  status: 'loading' | 'ready' | 'error';
  dashboard: HomeDashboard | null;
  retry: () => void;
}

export function useHomeDashboard(now: Date): HomeDashboardResult {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { timetable, ready } = useActiveTimetable();

  useEffect(() => {
    if (!ready) {
      return;
    }
    try {
      setDashboard(buildHomeDashboard(now, timetable));
      setStatus('ready');
    } catch {
      // Malformed timetable data — the screen shows a retryable error
      // instead of crashing. The engine fails fast by design.
      setDashboard(null);
      setStatus('error');
    }
  }, [now, attempt, timetable, ready]);

  const retry = useCallback(() => {
    setAttempt(previous => previous + 1);
  }, []);

  return { status, dashboard, retry };
}
