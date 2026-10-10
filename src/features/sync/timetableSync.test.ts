import { syncTimetable, type SyncClient } from './timetableSync';
import { loadSessionMapping } from './sessionMapping';
import { timetable as bundled } from '../timetable/data/timetable';

const mockMemory = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockMemory.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockMemory.delete(key);
  }),
}));

/**
 * In-memory Supabase double. Courses upsert on (user_id, code) with
 * deterministic uuids; sessions insert/update by id. Records every call
 * for duplicate and idempotency assertions.
 */
function fakeClient() {
  const courses: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];
  let counter = 0;
  const calls: Array<{ table: string; op: string }> = [];
  const nextUuid = () => {
    counter += 1;
    return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  };

  const builder = (table: string, op: string, payload?: unknown) => ({
    upsert: (values: unknown, options?: { onConflict?: string }) => {
      calls.push({ table, op: `${op}:upsert` });
      if (table === 'courses' && Array.isArray(values)) {
        const rows = values as Array<Record<string, unknown>>;
        const out: Array<{ id: unknown; code: unknown }> = rows.map(row => {
          const existing = courses.find(
            c => c.user_id === row.user_id && c.code === row.code,
          );
          if (existing) {
            Object.assign(existing, row);
            return { id: existing.id, code: existing.code };
          }
          const created: Record<string, unknown> = {
            ...row,
            id: nextUuid(),
          };
          courses.push(created);
          return { id: created.id, code: row.code };
        });
        void options;
        return { select: async () => ({ data: out, error: null }) };
      }
      return { select: async () => ({ data: [], error: null }) };
    },
    insert: (values: unknown) => {
      calls.push({ table, op: `${op}:insert` });
      const row = { ...(values as Record<string, unknown>), id: nextUuid() };
      (table === 'courses' ? courses : sessions).push(row);
      return { select: async () => ({ data: [{ id: row.id }], error: null }) };
    },
    update: (values: unknown) => ({
      eq: (column: string, value: unknown) => {
        calls.push({ table, op: `${op}:update` });
        const list = table === 'courses' ? courses : sessions;
        const found = list.find(r => r[column] === value);
        if (found) {
          Object.assign(found, values);
        }
        return { select: async () => ({ data: [{ id: value }], error: null }) };
      },
    }),
    eq: (_column: string, _value: unknown) => ({
      select: async () => ({ data: [], error: null }),
    }),
    select: async () => ({ data: payload ?? [], error: null }),
  });

  const client: SyncClient = {
    from: (table: string) =>
      builder(table, 'q') as unknown as ReturnType<SyncClient['from']>,
  };
  return { client, calls, courses, sessions };
}

/** Timetable sync: mapping-driven upserts, idempotent reruns, no dupes. */
describe('syncTimetable', () => {
  beforeEach(() => {
    mockMemory.clear();
  });

  it('inserts everything on first sync and records mappings', async () => {
    const { client, calls, courses, sessions } = fakeClient();
    const result = await syncTimetable(client, 'user-1', bundled);
    expect(result.errors).toEqual([]);
    expect(result.coursesUpserted).toBe(bundled.courses.length);
    expect(result.sessionsInserted).toBe(bundled.sessions.length);
    expect(result.sessionsUpdated).toBe(0);
    expect(courses).toHaveLength(bundled.courses.length);
    expect(sessions).toHaveLength(bundled.sessions.length);
    const map = await loadSessionMapping();
    expect(Object.keys(map)).toHaveLength(bundled.sessions.length);
    expect(calls.filter(c => c.op === 'q:insert').length).toBe(
      bundled.sessions.length,
    );
  });

  it('is idempotent: reruns update, never duplicate', async () => {
    const { client, courses, sessions } = fakeClient();
    const first = await syncTimetable(client, 'user-1', bundled);
    const second = await syncTimetable(client, 'user-1', bundled);
    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(second.sessionsInserted).toBe(0);
    expect(second.sessionsUpdated).toBe(bundled.sessions.length);
    expect(courses).toHaveLength(bundled.courses.length);
    expect(sessions).toHaveLength(bundled.sessions.length);
  });

  it('keeps server rows for locally deleted sessions (prunes mapping only)', async () => {
    const { client, sessions } = fakeClient();
    await syncTimetable(client, 'user-1', bundled);
    const trimmed = {
      ...bundled,
      sessions: bundled.sessions.slice(1),
    };
    const result = await syncTimetable(client, 'user-1', trimmed);
    expect(result.errors).toEqual([]);
    // Server rows untouched; stale mapping pruned.
    expect(sessions).toHaveLength(bundled.sessions.length);
    expect(result.mappingsPruned).toBe(1);
    const map = await loadSessionMapping();
    expect(map[bundled.sessions[0].id]).toBeUndefined();
  });

  it('reports per-record errors without aborting the sync', async () => {
    const { client } = fakeClient();
    const failing: SyncClient = {
      from: (table: string) => {
        const inner = client.from(table) as unknown as {
          upsert: (...args: unknown[]) => unknown;
          insert: (...args: unknown[]) => unknown;
          update: (...args: unknown[]) => unknown;
        };
        if (table === 'class_sessions') {
          return {
            ...inner,
            insert: () => {
              throw new Error('boom');
            },
          } as unknown as ReturnType<SyncClient['from']>;
        }
        return inner as unknown as ReturnType<SyncClient['from']>;
      },
    };
    const result = await syncTimetable(failing, 'user-1', bundled);
    expect(result.sessionsInserted).toBe(0);
    expect(result.errors.length).toBe(bundled.sessions.length);
    expect(result.coursesUpserted).toBe(bundled.courses.length);
  });
});
