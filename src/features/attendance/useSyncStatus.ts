import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../../services/supabase/client';
import { getUnsyncedAttendance } from './attendanceBridge';
import { loadLastSyncResult, type StoredSyncResult } from './attendanceSync';

export interface SyncStatus {
  configured: boolean;
  signedIn: boolean;
  pending: number;
  lastResult: StoredSyncResult | null;
}

/**
 * Truthful cloud-sync status for Settings. Never fabricates success:
 * without configuration or a session everything is reported as waiting,
 * and the pending count always comes from the real local outbox.
 */
export function useSyncStatus(): SyncStatus & { refresh: () => void } {
  const [status, setStatus] = useState<SyncStatus>({
    configured: false,
    signedIn: false,
    pending: 0,
    lastResult: null,
  });

  const load = useCallback(async () => {
    const configured = isSupabaseConfigured();
    let signedIn = false;
    if (configured) {
      try {
        const client = getSupabaseClient();
        const { data } = (await client?.auth.getSession()) ?? { data: null };
        signedIn = data?.session != null;
      } catch {
        signedIn = false;
      }
    }
    let pending = 0;
    try {
      pending = (await getUnsyncedAttendance()).length;
    } catch {
      pending = 0;
    }
    let lastResult: StoredSyncResult | null = null;
    try {
      lastResult = await loadLastSyncResult();
    } catch {
      lastResult = null;
    }
    setStatus({ configured, signedIn, pending, lastResult });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { ...status, refresh: load };
}
