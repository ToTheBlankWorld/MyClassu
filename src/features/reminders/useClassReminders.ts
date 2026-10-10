import { useEffect } from 'react';
import { buildReminderPayloads } from './classReminders';
import {
  cancelClassStartAlarms,
  cancelReminderAlarms,
  ensureReminderPermission,
  isReminderBridgeAvailable,
  scheduleReminders,
  setAlarmSoundVibration,
} from './reminderBridge';
import { loadReminderPrefs, type ReminderPrefs } from './reminderPrefs';
import {
  getActiveTimetableService,
  useActiveTimetable,
} from '../timetable/service/timetableStore';

const previousPrefs: { current: ReminderPrefs | null } = { current: null };

/**
 * Run one full reminder/alarm sync against the current prefs and active
 * timetable. Called on app start, on timetable changes, and explicitly
 * after preference toggles. Idempotent — every run converges on the
 * identical alarm set. Never throws.
 */
export async function syncClassReminders(): Promise<void> {
  try {
    if (!isReminderBridgeAvailable()) {
      return;
    }
    await ensureReminderPermission();
    const prefs = await loadReminderPrefs();
    await setAlarmSoundVibration(prefs.soundEnabled, prefs.vibrationEnabled);
    const activeService = getActiveTimetableService();
    const payloads = buildReminderPayloads(new Date(), activeService);
    await scheduleReminders(payloads, {
      reminders: prefs.remindersEnabled,
      alarms: prefs.classStartAlarmsEnabled,
    });
    // Turning a kind off cancels only that kind — never the other.
    const previous = previousPrefs.current;
    if (previous) {
      if (previous.remindersEnabled && !prefs.remindersEnabled) {
        await cancelReminderAlarms();
      }
      if (previous.classStartAlarmsEnabled && !prefs.classStartAlarmsEnabled) {
        await cancelClassStartAlarms();
      }
    }
    previousPrefs.current = prefs;
  } catch {
    // Offline-first local feature: never let it surface to the user.
  }
}

/**
 * App-start + timetable-change sync. Preference toggles call
 * [syncClassReminders] explicitly (see Settings) so changes apply
 * immediately without waiting for a restart.
 */
export function useClassReminders(): void {
  const { service, ready } = useActiveTimetable();

  useEffect(() => {
    if (!ready) {
      return;
    }
    syncClassReminders();
    // Re-sync when the timetable data or its identity changes.
  }, [ready, service]);
}
