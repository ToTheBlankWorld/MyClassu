import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../services/supabase/client';
import { loadSessionMapping } from '../sync/sessionMapping';
import type { Database } from '../../services/supabase/database.types';
import {
  getUnsyncedAttendance,
  markAttendanceSynced,
} from './attendanceBridge';
import type { LocalAttendanceRecord } from './attendance';

type AttendanceInsert =
  Database['public']['Tables']['attendance_records']['Insert'];

/**
 * Minimal offline-outbox sync adapter. Local records are always saved
 * first (native store); upload is best-effort, retryable, and idempotent
 * via upsert on the established unique key (class_session_id, date).
 *
 * Honest boundaries (documented, not hidden):
 * - No Supabase configuration or session → everything deferred, nothing
 *   attempted, nothing lost. The outbox simply waits.
 * - Local session IDs are opaque strings while server `class_sessions.id`
 *   is a uuid FK. Records whose session has no verified server mapping
 *   (see `timetableSync`, populated only after successful upserts) are
 *   reported as `unmapped` and skipped — attempting the upsert would only
 *   produce FK violations.
 */
export interface AttendanceSyncResult {
  synced: number;
  failed: number;
  unmapped: number;
  deferred: boolean;
  errors: string[];
}

const LAST_SYNC_KEY = 'myclassu.lastAttendanceSync.v1';

export interface StoredSyncResult extends AttendanceSyncResult {
  atMillis: number;
}

export async function saveLastSyncResult(
  result: AttendanceSyncResult,
): Promise<void> {
  try {
    const stored: StoredSyncResult = { ...result, atMillis: Date.now() };
    await AsyncStorage.setItem(LAST_SYNC_KEY, JSON.stringify(stored));
  } catch {
    // Telemetry must never break sync.
  }
}

export async function loadLastSyncResult(): Promise<StoredSyncResult | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSyncResult>;
    if (
      typeof parsed.synced !== 'number' ||
      typeof parsed.atMillis !== 'number'
    ) {
      return null;
    }
    return parsed as StoredSyncResult;
  } catch {
    return null;
  }
}

/**
 * Local session ID → server class_sessions uuid, from the durable mapping
 * store (populated by timetable sync). Unmapped sessions defer honestly —
 * attempting the upsert would only produce FK violations.
 */
export async function resolveServerSessionId(
  localSessionId: string,
): Promise<string | null> {
  try {
    return (await loadSessionMapping())[localSessionId] ?? null;
  } catch {
    return null;
  }
}

export async function syncPendingAttendance(): Promise<AttendanceSyncResult> {
  const result: AttendanceSyncResult = {
    synced: 0,
    failed: 0,
    unmapped: 0,
    deferred: false,
    errors: [],
  };
  let unsynced: LocalAttendanceRecord[];
  try {
    unsynced = await getUnsyncedAttendance();
  } catch (error) {
    result.deferred = true;
    result.errors.push(`Outbox unreadable: ${messageOf(error)}`);
    return result;
  }
  if (unsynced.length === 0) {
    return result;
  }
  const client = getSupabaseClient();
  if (!client) {
    result.deferred = true;
    return result;
  }
  let userId: string | null = null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      throw error;
    }
    userId = data.session?.user.id ?? null;
  } catch (error) {
    result.deferred = true;
    result.errors.push(`No session: ${messageOf(error)}`);
    return result;
  }
  if (!userId) {
    result.deferred = true;
    return result;
  }

  const sessionMap = await loadSessionMapping();
  const uploaded: string[] = [];
  for (const record of unsynced) {
    const serverSessionId = sessionMap[record.sessionId];
    if (!serverSessionId) {
      result.unmapped += 1;
      continue;
    }
    try {
      const row: AttendanceInsert = {
        user_id: userId,
        class_session_id: serverSessionId,
        date: record.dateKey,
        status: record.status,
        reason_category: record.reasonCategory ?? null,
        reason_text: record.reasonText ?? null,
        marked_at: new Date(record.markedAtMillis).toISOString(),
      };
      const { error } = await client
        .from('attendance_records')
        .upsert(row, { onConflict: 'class_session_id,date' });
      if (error) {
        throw error;
      }
      uploaded.push(record.id);
      result.synced += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${record.id}: ${messageOf(error)}`);
    }
  }
  if (uploaded.length > 0) {
    try {
      await markAttendanceSynced(uploaded);
    } catch (error) {
      // Uploads succeeded but bookkeeping failed — records will upload
      // again idempotently next run (upsert, same unique key).
      result.errors.push(`Bookkeeping failed: ${messageOf(error)}`);
    }
  }
  return result;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
