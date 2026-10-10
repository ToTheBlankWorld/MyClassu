import type { ReportPrefs } from '../reports/reportPrefs';
import type { SyncClient } from './timetableSync';

/**
 * Local report preferences → server `email_settings`. The server row is
 * what the scheduled Edge Function reads; until this sync runs (auth +
 * configuration required), reports stay locally configured but unsent —
 * reported honestly in Settings.
 */

export interface EmailSettingsSyncResult {
  synced: boolean;
  error: string | null;
}

export async function syncEmailSettings(
  client: SyncClient,
  userId: string,
  prefs: ReportPrefs,
): Promise<EmailSettingsSyncResult> {
  try {
    const { error } = await client
      .from('email_settings')
      .upsert(
        {
          user_id: userId,
          enabled: prefs.dailyEnabled || prefs.weeklyEnabled,
          report_time: '18:00',
          email_address: prefs.email === '' ? null : prefs.email,
        },
        { onConflict: 'user_id' },
      )
      .select('user_id');
    if (error) {
      throw error;
    }
    return { synced: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { synced: false, error: message };
  }
}
