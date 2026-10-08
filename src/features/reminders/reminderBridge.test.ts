// AsyncStorage ships ESM; mock it like the Supabase client tests do.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import {
  cancelTestReminder,
  canScheduleExactAlarms,
  getReminderPermissionStatus,
  getScheduledReminderIds,
  isReminderBridgeAvailable,
  scheduleReminders,
  scheduleTestReminder,
} from './reminderBridge';

/**
 * Bridge behavior without the native module (Jest/iOS): every call degrades
 * gracefully — lists resolve empty, lookups resolve null, scheduling throws
 * a clear error instead of crashing. (Native-backed paths are verified on
 * the physical device with logcat, per the Stage 5 checklist.)
 */
describe('reminderBridge — native module absent', () => {
  it('reports the bridge as unavailable', () => {
    expect(isReminderBridgeAvailable()).toBe(false);
  });

  it('resolves empty diagnostics instead of throwing', async () => {
    await expect(getScheduledReminderIds()).resolves.toEqual([]);
    await expect(canScheduleExactAlarms()).resolves.toBeNull();
  });

  it('throws a clear error when scheduling without the bridge', async () => {
    await expect(scheduleReminders([])).rejects.toThrow(
      'ClassReminder native module is unavailable',
    );
    await expect(scheduleTestReminder('T', 'B', 30)).rejects.toThrow(
      'ClassReminder native module is unavailable',
    );
    await expect(cancelTestReminder()).rejects.toThrow(
      'ClassReminder native module is unavailable',
    );
  });

  it('treats permission as granted off Android', async () => {
    // Jest runs with Platform.OS !== 'android' under this preset.
    await expect(getReminderPermissionStatus()).resolves.toBe('granted');
  });
});
