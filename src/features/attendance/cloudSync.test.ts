jest.mock('react-native-config', () => ({}));
jest.mock('react-native-url-polyfill/auto', () => ({}));

import { runCloudSync } from './useAttendanceSync';
import * as supabaseClient from '../../services/supabase/client';
import * as timetableStore from '../timetable/service/timetableStore';
import { timetable as bundled } from '../timetable/data/timetable';

// NOTE: no file-local AsyncStorage mock here — the global in-memory mock
// (jest/async-storage-mock.js) must stay live so mapping writes persist
// across calls within a test. A static null-mock would silently swallow
// every write (this exact mistake cost real debugging time once).

/**
 * Full pipeline: timetable mapping first, then the attendance outbox,
 * then report preferences — each stage degrading independently.
 */
describe('runCloudSync', () => {
  afterEach(() => {
    // NOTE: no jest.restoreAllMocks() here — it would neuter the shared
    // AsyncStorage mock's implementations for later tests. Spies below
    // are re-declared per test, so nothing leaks.
    jest.spyOn(supabaseClient, 'getSupabaseClient').mockRestore();
    jest.spyOn(timetableStore, 'getActiveTimetable').mockRestore();
  });

  it('defers everything without configuration', async () => {
    jest.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue(null);
    const result = await runCloudSync();
    expect(result.deferred).toBe(true);
    expect(result.timetable).toBeNull();
    expect(result.emailSettings).toBe(false);
  });

  it('defers without a session', async () => {
    const fake = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    };
    jest
      .spyOn(supabaseClient, 'getSupabaseClient')
      .mockReturnValue(fake as never);
    const result = await runCloudSync();
    expect(result.deferred).toBe(true);
    expect(result.timetable).toBeNull();
  });

  it('syncs timetable, attendance, and email prefs when authed', async () => {
    let counter = 0;
    const nextUuid = () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    };
    const tables: Record<string, Array<Record<string, unknown>>> = {
      courses: [],
      class_sessions: [],
      attendance_records: [],
      email_settings: [],
    };
    const builder = (table: string) => ({
      upsert: (values: unknown) => {
        const rows = (Array.isArray(values) ? values : [values]) as Array<
          Record<string, unknown>
        >;
        const out = rows.map(row => {
          const list = tables[table] ?? [];
          const match =
            table === 'courses'
              ? list.find(r => r.user_id === row.user_id && r.code === row.code)
              : table === 'email_settings'
              ? list.find(r => r.user_id === row.user_id)
              : undefined;
          if (match) {
            Object.assign(match, row);
            return { id: match.id, code: match.code };
          }
          const created: Record<string, unknown> = {
            ...row,
            id: nextUuid(),
          };
          (tables[table] ?? []).push(created);
          tables[table] = tables[table] ?? [];
          return { id: created.id, code: created.code };
        });
        return { select: async () => ({ data: out, error: null }) };
      },
      insert: (values: unknown) => {
        const row = { ...(values as Record<string, unknown>), id: nextUuid() };
        tables[table].push(row);
        return {
          select: async () => ({ data: [{ id: row.id }], error: null }),
        };
      },
      update: (values: unknown) => ({
        eq: (_column: string, _value: unknown) => {
          void values;
          return {
            select: async () => ({ data: [{ id: 'x' }], error: null }),
          };
        },
      }),
    });
    const fake = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: 'user-1' } } },
          error: null,
        }),
      },
      from: (table: string) => builder(table),
    };
    jest
      .spyOn(supabaseClient, 'getSupabaseClient')
      .mockReturnValue(fake as never);
    jest.spyOn(timetableStore, 'getActiveTimetable').mockReturnValue(bundled);
    const result = await runCloudSync();
    expect(result.timetable?.coursesUpserted).toBe(bundled.courses.length);
    expect(result.errors).toEqual([]);
    expect(result.deferred).toBe(false);
    expect(result.timetable?.sessionsInserted).toBe(bundled.sessions.length);
    expect(result.emailSettings).toBe(true);
    expect(result.unmapped).toBe(0);
    expect(tables.email_settings).toHaveLength(1);
  });
});
