import { useEffect } from 'react';
import { buildReminderPayloads } from './classReminders';
import {
  ensureReminderPermission,
  isReminderBridgeAvailable,
  scheduleReminders,
} from './reminderBridge';
import { timetableService } from '../timetable/service/timetableService';

/**
 * App-start reminder sync: ensures the notification channel exists
 * (native, on first schedule), settles POST_NOTIFICATIONS once, then
 * replaces the native alarm set with the next upcoming occurrences.
 * Idempotent — every launch converges on the identical alarm set, and any
 * failure is swallowed so reminders can never break app start.
 */
export function useClassReminders(): void {
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        if (!isReminderBridgeAvailable()) {
          return;
        }
        await ensureReminderPermission();
        if (cancelled) {
          return;
        }
        const payloads = buildReminderPayloads(new Date(), timetableService);
        await scheduleReminders(payloads);
      } catch {
        // Offline-first local feature: never let it surface to the user.
      }
    };
    sync();
    return () => {
      cancelled = true;
    };
  }, []);
}
