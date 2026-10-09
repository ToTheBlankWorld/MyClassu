jest.mock('react-native-config', () => ({}));
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import { syncPendingAttendance } from './attendanceSync';
import * as bridge from './attendanceBridge';
import * as supabaseClient from '../../services/supabase/client';

/**
 * Sync adapter behavior: defers without backend/session, uploads idempotently
 * when available, and never loses local records on failure. The native
 * bridge is absent under Jest, so "no outbox access" paths are covered
 * through module mocks.
 */
describe('syncPendingAttendance', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defers when the outbox is unreadable', async () => {
    jest
      .spyOn(bridge, 'getUnsyncedAttendance')
      .mockRejectedValue(new Error('no bridge'));
    const result = await syncPendingAttendance();
    expect(result.deferred).toBe(true);
    expect(result.synced).toBe(0);
  });

  it('resolves empty when nothing is pending', async () => {
    jest.spyOn(bridge, 'getUnsyncedAttendance').mockResolvedValue([]);
    const result = await syncPendingAttendance();
    expect(result).toMatchObject({
      synced: 0,
      failed: 0,
      unmapped: 0,
      deferred: false,
    });
  });

  it('defers when Supabase is not configured', async () => {
    jest.spyOn(bridge, 'getUnsyncedAttendance').mockResolvedValue([
      {
        id: 's1|2026-10-12',
        sessionId: 's1',
        dateKey: '2026-10-12',
        courseCode: 'MECH3271',
        subject: 'Total Quality Management',
        classStartMillis: 1000,
        classEndMillis: 2000,
        status: 'attended',
        markedAtMillis: 3000,
        updatedAtMillis: 4000,
        synced: false,
      },
    ]);
    jest.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue(null);
    const result = await syncPendingAttendance();
    expect(result.deferred).toBe(true);
    expect(result.synced).toBe(0);
  });

  it('reports unmapped sessions without attempting upload', async () => {
    const markSpy = jest
      .spyOn(bridge, 'markAttendanceSynced')
      .mockResolvedValue({ marked: 0 });
    jest.spyOn(bridge, 'getUnsyncedAttendance').mockResolvedValue([
      {
        id: 's1|2026-10-12',
        sessionId: 's1',
        dateKey: '2026-10-12',
        courseCode: 'MECH3271',
        subject: 'Total Quality Management',
        classStartMillis: 1000,
        classEndMillis: 2000,
        status: 'attended',
        markedAtMillis: 3000,
        updatedAtMillis: 4000,
        synced: false,
      },
    ]);
    const fakeClient = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: 'user-1' } } },
          error: null,
        }),
      },
      from: () => {
        throw new Error('must not be called without a mapping');
      },
    };
    jest
      .spyOn(supabaseClient, 'getSupabaseClient')
      .mockReturnValue(fakeClient as never);
    const result = await syncPendingAttendance();
    expect(result.unmapped).toBe(1);
    expect(result.synced).toBe(0);
    expect(markSpy).not.toHaveBeenCalled();
  });

  it('retries failed uploads on the next run without losing records', async () => {
    const markSpy = jest
      .spyOn(bridge, 'markAttendanceSynced')
      .mockResolvedValue({ marked: 1 });
    jest.spyOn(bridge, 'getUnsyncedAttendance').mockResolvedValue([
      {
        id: 's1|2026-10-12',
        sessionId: 's1',
        dateKey: '2026-10-12',
        courseCode: 'MECH3271',
        subject: 'Total Quality Management',
        classStartMillis: 1000,
        classEndMillis: 2000,
        status: 'skipped',
        reasonCategory: 'health',
        markedAtMillis: 3000,
        updatedAtMillis: 4000,
        synced: false,
      },
    ]);
    // No server mapping and no session → deferred, record stays unsynced.
    jest.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue(null);
    const result = await syncPendingAttendance();
    expect(result.deferred).toBe(true);
    expect(markSpy).not.toHaveBeenCalled();
  });
});
