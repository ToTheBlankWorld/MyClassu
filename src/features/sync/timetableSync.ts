import type { Timetable } from '../timetable/data/timetable';
import {
  loadCourseMapping,
  loadSessionMapping,
  saveSessionMapping,
  storeCourseMapping,
  storeSessionMapping,
} from './sessionMapping';

/**
 * Local timetable → Supabase sync. Pushes courses and sessions for the
 * authenticated user, then persists verified uuid mappings so the
 * attendance outbox becomes eligible for upload.
 *
 * Safety rules:
 * - Mapping entries are written only after the server confirms the row
 *   (insert/update success). Nothing is ever guessed.
 * - Repeated runs converge: courses upsert on the unique (user_id, code)
 *   key; mapped sessions update by id; unmapped sessions insert once and
 *   then update forever after.
 * - Server rows for locally deleted sessions are LEFT ALONE — deleting
 *   cloud history would orphan past attendance. Their stale mappings are
 *   pruned locally instead.
 * - Every failure is per-record and retryable; the local timetable is the
 *   authority and is never modified here.
 */

export interface TimetableSyncResult {
  coursesUpserted: number;
  sessionsInserted: number;
  sessionsUpdated: number;
  mappingsPruned: number;
  errors: string[];
}

/**
 * Minimal structural surface used from the Supabase client (mockable).
 * Terminal calls return PromiseLike because the real PostgREST builders
 * are thenables — this keeps the production client assignable without
 * casts while fakes can return plain promises.
 */
export interface SyncSelectBuilder {
  select(columns?: string): PromiseLike<{ data: unknown; error: unknown }>;
}

export interface SyncUpdateBuilder {
  eq(column: string, value: unknown): SyncSelectBuilder;
}

export interface SyncQueryBuilder {
  upsert(values: unknown, options?: { onConflict?: string }): SyncSelectBuilder;
  insert(values: unknown): SyncSelectBuilder;
  update(values: unknown): SyncUpdateBuilder;
}

export interface SyncClient {
  from(table: string): SyncQueryBuilder;
}

interface CourseRow {
  id: string;
  code: string;
}

interface SessionRow {
  id: string;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export async function syncTimetable(
  client: SyncClient,
  userId: string,
  timetable: Timetable,
): Promise<TimetableSyncResult> {
  const result: TimetableSyncResult = {
    coursesUpserted: 0,
    sessionsInserted: 0,
    sessionsUpdated: 0,
    mappingsPruned: 0,
    errors: [],
  };

  // 1. Courses first (sessions reference them): upsert on (user_id, code).
  const courseRows = timetable.courses.map(course => ({
    user_id: userId,
    code: course.code,
    title: course.title,
    instructor: course.instructor ?? null,
  }));
  try {
    const { data, error } = await client
      .from('courses')
      .upsert(courseRows, { onConflict: 'user_id,code' })
      .select('id,code');
    if (error) {
      throw error;
    }
    for (const row of (data ?? []) as CourseRow[]) {
      const local = timetable.courses.find(course => course.code === row.code);
      if (local && typeof row.id === 'string') {
        try {
          await storeCourseMapping(local.id, row.id);
          result.coursesUpserted += 1;
        } catch (mappingError) {
          result.errors.push(
            `course ${local.code}: ${errorMessage(mappingError)}`,
          );
        }
      }
    }
  } catch (error) {
    result.errors.push(`courses: ${errorMessage(error)}`);
    return result;
  }

  const courseMap = await loadCourseMapping();
  const sessionMap = await loadSessionMapping();

  // 2. Sessions: update mapped rows, insert unmapped ones exactly once.
  for (const session of timetable.sessions) {
    const courseUuid = courseMap[session.courseId];
    if (!courseUuid) {
      result.errors.push(`session ${session.id}: course has no server mapping`);
      continue;
    }
    const row = {
      user_id: userId,
      course_id: courseUuid,
      weekday: session.weekday,
      start_time: session.startTime,
      end_time: session.endTime,
      room: session.room ?? null,
    };
    const mappedId = sessionMap[session.id];
    try {
      if (mappedId) {
        const { error } = await client
          .from('class_sessions')
          .update(row)
          .eq('id', mappedId)
          .select('id');
        if (error) {
          throw error;
        }
        result.sessionsUpdated += 1;
      } else {
        const { data, error } = await client
          .from('class_sessions')
          .insert(row)
          .select('id');
        if (error) {
          throw error;
        }
        const inserted = (data ?? []) as SessionRow[];
        if (!inserted[0] || typeof inserted[0].id !== 'string') {
          throw new Error('server returned no session id');
        }
        await storeSessionMapping(session.id, inserted[0].id);
        result.sessionsInserted += 1;
      }
    } catch (error) {
      result.errors.push(`session ${session.id}: ${errorMessage(error)}`);
    }
  }

  // 3. Prune mappings for sessions that no longer exist locally. Server
  // rows (and their attendance) are deliberately left untouched.
  const liveIds = new Set(timetable.sessions.map(session => session.id));
  const freshMap = await loadSessionMapping();
  for (const localId of Object.keys(freshMap)) {
    if (!liveIds.has(localId)) {
      delete freshMap[localId];
      result.mappingsPruned += 1;
    }
  }
  if (result.mappingsPruned > 0) {
    await saveSessionMapping(freshMap);
  }

  return result;
}
