import { useCallback, useEffect, useState } from 'react';
import type { HomeDashboard } from './dashboard';
import { buildHomeDashboard } from './dashboard';

/**
 * Home screen data container: drives the pure dashboard selector from a live
 * `now` instant and exposes a status machine for the screen's loading,
 * ready and error presentations. The bundled timetable loads synchronously,
 * so 'loading' covers initialization and 'error' covers malformed data —
 * Supabase is never involved.
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

  useEffect(() => {
    try {
      setDashboard(buildHomeDashboard(now));
      setStatus('ready');
    } catch {
      // Malformed timetable data — the screen shows a retryable error
      // instead of crashing. The engine fails fast by design.
      setDashboard(null);
      setStatus('error');
    }
  }, [now, attempt]);

  const retry = useCallback(() => {
    setAttempt(previous => previous + 1);
  }, []);

  return { status, dashboard, retry };
}
