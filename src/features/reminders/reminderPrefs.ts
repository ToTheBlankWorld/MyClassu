import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * Reminder + alarm preferences. Persisted locally, honored by the native
 * scheduler (which arms only the enabled kinds) and the alarm Activity
 * (which reads sound/vibration). The 5-minute lead time is intentionally
 * NOT configurable — the native scheduler hardcodes it, and this module
 * refuses to promise otherwise.
 */

export interface ReminderPrefs {
  remindersEnabled: boolean;
  classStartAlarmsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  remindersEnabled: true,
  classStartAlarmsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export const REMINDER_PREFS_KEY = 'myclassu.reminderPrefs.v1';

function sanitize(raw: unknown): ReminderPrefs {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_REMINDER_PREFS };
  }
  const candidate = raw as Record<string, unknown>;
  const booleanOr = (key: keyof ReminderPrefs, fallback: boolean): boolean =>
    typeof candidate[key] === 'boolean'
      ? (candidate[key] as boolean)
      : fallback;
  return {
    remindersEnabled: booleanOr('remindersEnabled', true),
    classStartAlarmsEnabled: booleanOr('classStartAlarmsEnabled', true),
    soundEnabled: booleanOr('soundEnabled', true),
    vibrationEnabled: booleanOr('vibrationEnabled', true),
  };
}

export function parseReminderPrefs(raw: string | null): ReminderPrefs | null {
  if (!raw) {
    return null;
  }
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadReminderPrefs(): Promise<ReminderPrefs> {
  try {
    return (
      parseReminderPrefs(await AsyncStorage.getItem(REMINDER_PREFS_KEY)) ?? {
        ...DEFAULT_REMINDER_PREFS,
      }
    );
  } catch {
    return { ...DEFAULT_REMINDER_PREFS };
  }
}

export async function saveReminderPrefs(prefs: ReminderPrefs): Promise<void> {
  await AsyncStorage.setItem(
    REMINDER_PREFS_KEY,
    JSON.stringify(sanitize(prefs)),
  );
}

export interface UseReminderPrefsResult {
  prefs: ReminderPrefs;
  ready: boolean;
  update: (patch: Partial<ReminderPrefs>) => Promise<void>;
}

export function useReminderPrefs(): UseReminderPrefsResult {
  const [prefs, setPrefs] = useState<ReminderPrefs>({
    ...DEFAULT_REMINDER_PREFS,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadReminderPrefs()
      .then(loaded => {
        if (!cancelled) {
          setPrefs(loaded);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<ReminderPrefs>) => {
    setPrefs(previous => {
      const next = sanitize({ ...previous, ...patch });
      saveReminderPrefs(next).catch(() => undefined);
      return next;
    });
  }, []);

  return { prefs, ready, update };
}
