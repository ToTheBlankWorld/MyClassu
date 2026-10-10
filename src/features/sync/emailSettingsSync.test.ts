import { syncEmailSettings } from './emailSettingsSync';
import type { SyncClient } from './timetableSync';
import { DEFAULT_REPORT_PREFS } from '../reports/reportPrefs';

/** Email-settings sync: upsert keyed on user_id, honest failures. */
describe('syncEmailSettings', () => {
  const calls: Array<{ table: string; values: unknown; conflict?: string }> =
    [];

  const client: SyncClient = {
    from: (table: string) => ({
      upsert: (values: unknown, options?: { onConflict?: string }) => {
        calls.push({ table, values, conflict: options?.onConflict });
        return {
          select: async () => ({ data: [{ user_id: 'user-1' }], error: null }),
        };
      },
      insert: () => {
        throw new Error('must not insert email settings');
      },
      update: () => {
        throw new Error('must not update email settings');
      },
    }),
  };

  beforeEach(() => {
    calls.length = 0;
  });

  it('upserts preferences keyed on the user id', async () => {
    const result = await syncEmailSettings(client, 'user-1', {
      ...DEFAULT_REPORT_PREFS,
      dailyEnabled: true,
      email: 'student@example.com',
    });
    expect(result).toEqual({ synced: true, error: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      table: 'email_settings',
      conflict: 'user_id',
    });
    expect(calls[0].values).toMatchObject({
      user_id: 'user-1',
      enabled: true,
      report_time: '18:00',
      email_address: 'student@example.com',
    });
  });

  it('stores null email and disables delivery when reports are off', async () => {
    const result = await syncEmailSettings(client, 'user-1', {
      ...DEFAULT_REPORT_PREFS,
      dailyEnabled: false,
    });
    expect(result.synced).toBe(true);
    expect(calls[0].values).toMatchObject({
      enabled: false,
      email_address: null,
    });
  });

  it('reports failures without throwing', async () => {
    const failing: SyncClient = {
      from: () => ({
        upsert: () => ({
          select: async () => ({ data: null, error: new Error('denied') }),
        }),
        insert: () => {
          throw new Error('unused');
        },
        update: () => {
          throw new Error('unused');
        },
      }),
    };
    const result = await syncEmailSettings(
      failing,
      'user-1',
      DEFAULT_REPORT_PREFS,
    );
    expect(result.synced).toBe(false);
    expect(result.error).toContain('denied');
  });
});
