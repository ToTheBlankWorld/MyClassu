jest.mock('react-native-config', () => ({}));
jest.mock('react-native-url-polyfill/auto', () => ({}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAttendanceSync } from './useAttendanceSync';
import { loadLastSyncResult } from './attendanceSync';
import * as supabaseClient from '../../services/supabase/client';
import {
  commitTimetable,
  getActiveTimetable,
} from '../timetable/service/timetableStore';

// NOTE: the global in-memory AsyncStorage mock stays live (no file-local
// mock) so mapping writes and sync telemetry persist across calls.

function Probe(): null {
  useAttendanceSync();
  return null;
}

async function flushTicks(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise<void>(resolve => {
      setImmediate(() => resolve());
    });
  }
}

/**
 * Cloud-sync scheduling: the pipeline flushes on mount AND again after a
 * timetable commit (edits change server mappings, which change outbox
 * eligibility). The fake backend counts entry points per run.
 */
describe('useAttendanceSync', () => {
  afterEach(() => {
    jest.spyOn(supabaseClient, 'getSupabaseClient').mockRestore();
  });

  it('re-runs the pipeline when the timetable commits', async () => {
    let counter = 0;
    const nextUuid = () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    };
    const fromCalls: string[] = [];
    const fake = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: 'user-1' } } },
          error: null,
        }),
      },
      from: (table: string) => {
        fromCalls.push(table);
        return {
          upsert: (values: unknown) => ({
            select: async () => ({
              data: (Array.isArray(values) ? values : [values]).map(
                (row: Record<string, unknown>) => ({
                  id: nextUuid(),
                  code: row.code,
                  user_id: row.user_id,
                }),
              ),
              error: null,
            }),
          }),
          insert: () => ({
            select: async () => ({ data: [{ id: nextUuid() }], error: null }),
          }),
          update: () => ({
            eq: () => ({
              select: async () => ({ data: [{ id: nextUuid() }], error: null }),
            }),
          }),
        };
      },
    };
    jest
      .spyOn(supabaseClient, 'getSupabaseClient')
      .mockReturnValue(fake as never);

    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<Probe />);
    });
    await act(async () => {
      await flushTicks();
    });
    // Mount flush ran the full authed pipeline and recorded telemetry.
    expect(fromCalls.length).toBeGreaterThan(0);
    const afterMount = await loadLastSyncResult();
    expect(afterMount).not.toBeNull();
    expect(afterMount?.deferred).toBe(false);

    // A timetable commit (same data, new store identity) re-runs it:
    // server mappings refresh and the outbox becomes eligible at once.
    const before = fromCalls.length;
    await act(async () => {
      await commitTimetable(getActiveTimetable());
    });
    await act(async () => {
      await flushTicks();
    });
    expect(fromCalls.length).toBeGreaterThan(before);

    await act(async () => {
      tree.unmount();
    });
  });
});
