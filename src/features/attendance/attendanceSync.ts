import { getSupabaseClient } from '../../services/supabase/client';
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
 * - The bundled timetable's session IDs are local strings, while the
 *   server `class_sessions.id` is a uuid FK. Records whose session has no
 *   server uuid mapping are reported as `unmapped` and skipped — attempting
 *   the upsert would only produce FK violations. The mapping arrives with
 *   timetable cloud sync (a later stage); until then the local store is
 *   complete and authoritative on-device.
 */
export interface AttendanceSyncResult {
  synced: number;
  failed: number;
  unmapped: number;
  deferred: boolean;
  errors: string[];
}

/** Local session ID → server class_sessions uuid. Empty until cloud sync. */
const SERVER_SESSION_IDS: ReadonlyMap<string, string> = new Map();

export function resolveServerSessionId(localSessionId: string): string | null {
  return SERVER_SESSION_IDS.get(localSessionId) ?? null;
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

  const uploaded: string[] = [];
  for (const record of unsynced) {
    const serverSessionId = resolveServerSessionId(record.sessionId);
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
