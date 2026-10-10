import { useEffect } from 'react';
import { getSupabaseClient } from '../../services/supabase/client';
import type { SyncClient } from '../sync/timetableSync';
import {
  getActiveTimetable,
  useActiveTimetable,
} from '../timetable/service/timetableStore';
import { loadReportPrefs } from '../reports/reportPrefs';
import { syncTimetable } from '../sync/timetableSync';
import { syncEmailSettings } from '../sync/emailSettingsSync';
import {
  saveLastSyncResult,
  syncPendingAttendance,
  type AttendanceSyncResult,
} from './attendanceSync';

export interface CloudSyncSummary extends AttendanceSyncResult {
  timetable: {
    coursesUpserted: number;
    sessionsInserted: number;
    sessionsUpdated: number;
    errors: string[];
  } | null;
  emailSettings: boolean;
}

/**
 * Full cloud pipeline on app start (best-effort, silent):
 * timetable mapping → attendance outbox → report preferences.
 * Each stage degrades independently; local-first behavior never waits.
 */
export async function runCloudSync(): Promise<CloudSyncSummary> {
  const summary: CloudSyncSummary = {
    synced: 0,
    failed: 0,
    unmapped: 0,
    deferred: false,
    errors: [],
    timetable: null,
    emailSettings: false,
  };
  try {
    const client = getSupabaseClient();
    if (!client) {
      summary.deferred = true;
      return summary;
    }
    let userId: string | null = null;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw error;
      }
      userId = data.session?.user.id ?? null;
    } catch {
      userId = null;
    }
    if (!userId) {
      summary.deferred = true;
      return summary;
    }
    // The production client's PostgREST builders satisfy SyncClient at
    // runtime; a direct assignment trips TS's depth limiter on the
    // library's recursive generics, so the adaptation lives here alone.
    const syncable = client as unknown as SyncClient;
    try {
      const timetableResult = await syncTimetable(
        syncable,
        userId,
        getActiveTimetable(),
      );
      summary.timetable = {
        coursesUpserted: timetableResult.coursesUpserted,
        sessionsInserted: timetableResult.sessionsInserted,
        sessionsUpdated: timetableResult.sessionsUpdated,
        errors: timetableResult.errors,
      };
      summary.errors.push(
        ...timetableResult.errors.map(error => `timetable: ${error}`),
      );
    } catch (error) {
      summary.errors.push(
        `timetable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      const reportPrefs = await loadReportPrefs();
      const emailResult = await syncEmailSettings(
        syncable,
        userId,
        reportPrefs,
      );
      summary.emailSettings = emailResult.synced;
      if (emailResult.error) {
        summary.errors.push(`email settings: ${emailResult.error}`);
      }
    } catch (error) {
      summary.errors.push(
        `email settings: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const attendance = await syncPendingAttendance();
    summary.synced = attendance.synced;
    summary.failed = attendance.failed;
    summary.unmapped = attendance.unmapped;
    summary.errors.push(...attendance.errors);
    await saveLastSyncResult(summary);
  } catch {
    // Never surfaces: the outbox waits for the next launch.
  }
  return summary;
}

/**
 * Best-effort cloud sync on app start and whenever the timetable changes.
 * A timetable edit is the moment server mappings (and therefore outbox
 * eligibility) change, so waiting for the next launch would needlessly
 * delay uploads. Silent by design: sync must never break launch or
 * editing, and an empty/unconfigured backend simply defers.
 */
export function useAttendanceSync(): void {
  const { service, ready } = useActiveTimetable();

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;
    const flush = async () => {
      await runCloudSync();
      if (cancelled) {
        return;
      }
    };
    flush();
    return () => {
      cancelled = true;
    };
    // Re-run when the timetable data or its identity changes (commits
    // rebuild the bound service). runCloudSync is idempotent, so
    // overlapping runs converge instead of duplicating.
  }, [ready, service]);
}
