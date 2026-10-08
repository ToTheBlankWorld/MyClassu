import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClassReminderPayload } from './classReminders';

/**
 * Typed wrapper around the native ClassReminder module. Every method is
 * safe to call on any platform: outside Android (iOS, Jest) the bridge is
 * absent and each call resolves a graceful "unavailable" value instead of
 * throwing — the app must never crash for lack of a reminder backend.
 */

interface NativeScheduleResult {
  scheduled: number;
  skippedPast: number;
  exact: boolean;
}

interface NativeCancelResult {
  cancelled: number;
}

interface NativeTestResult {
  scheduled: boolean;
  triggerAt: number;
}

interface ClassReminderNative {
  scheduleReminders(reminders: unknown[]): Promise<NativeScheduleResult>;
  cancelAllReminders(): Promise<NativeCancelResult>;
  getScheduledReminders(): Promise<string[]>;
  canScheduleExactAlarms(): Promise<boolean>;
  scheduleTestReminder(
    title: string,
    body: string,
    inSeconds: number,
  ): Promise<NativeTestResult>;
  cancelTestReminder(): Promise<boolean>;
}

const native = NativeModules.ClassReminder as ClassReminderNative | undefined;

export const isReminderBridgeAvailable = (): boolean => native != null;

const unavailable = (): never => {
  throw new Error(
    'ClassReminder native module is unavailable on this platform.',
  );
};

export async function scheduleReminders(
  payloads: ClassReminderPayload[],
): Promise<NativeScheduleResult> {
  if (!native) {
    throw unavailable();
  }
  return native.scheduleReminders(
    payloads.map(payload => ({
      dateKey: payload.dateKey,
      sessionId: payload.sessionId,
      subject: payload.subject,
      startMinutes: payload.startMinutes,
      startLabel: payload.startLabel,
      ...(payload.room ? { room: payload.room } : {}),
    })),
  );
}

export async function cancelAllReminders(): Promise<NativeCancelResult> {
  if (!native) {
    throw unavailable();
  }
  return native.cancelAllReminders();
}

export async function getScheduledReminderIds(): Promise<string[]> {
  if (!native) {
    return [];
  }
  return native.getScheduledReminders();
}

export async function canScheduleExactAlarms(): Promise<boolean | null> {
  if (!native) {
    return null;
  }
  return native.canScheduleExactAlarms();
}

/** Debug builds only (native refuses in release). */
export async function cancelTestReminder(): Promise<boolean> {
  if (!native) {
    throw unavailable();
  }
  return native.cancelTestReminder();
}

/** Debug builds only (native refuses in release). */
export async function scheduleTestReminder(
  title: string,
  body: string,
  inSeconds: number,
): Promise<NativeTestResult> {
  if (!native) {
    throw unavailable();
  }
  return native.scheduleTestReminder(title, body, inSeconds);
}

const PERMISSION_ASKED_KEY = 'myclassu.reminders.permissionAsked.v1';

/**
 * POST_NOTIFICATIONS status on Android 13+; 'granted' everywhere else
 * (pre-33 grants at install, other platforms are out of scope).
 */
export async function getReminderPermissionStatus(): Promise<
  'granted' | 'denied' | 'unavailable'
> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return 'granted';
  }
  if (!native) {
    return 'unavailable';
  }
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return granted ? 'granted' : 'denied';
}

/**
 * Request POST_NOTIFICATIONS at most once per install (persisted flag), and
 * only when not already granted. Never throws — denial simply means the
 * scheduler stays armed while notifications stay silent.
 */
export async function ensureReminderPermission(): Promise<
  'granted' | 'denied' | 'unavailable'
> {
  const current = await getReminderPermissionStatus();
  if (current !== 'denied') {
    return current;
  }
  try {
    const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
    if (asked === '1') {
      return 'denied';
    }
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  } catch {
    // Permission plumbing must never break app start.
  } finally {
    try {
      await AsyncStorage.setItem(PERMISSION_ASKED_KEY, '1');
    } catch {
      // Storage failure: worst case we ask again next launch.
    }
  }
  return getReminderPermissionStatus();
}
