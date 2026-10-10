import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_REMINDER_PREFS,
  loadReminderPrefs,
  parseReminderPrefs,
  saveReminderPrefs,
} from './reminderPrefs';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const mockedStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

/** Reminder preferences: defaults, sanitizing, persistence. */
describe('reminderPrefs', () => {
  beforeEach(() => {
    mockedStorage.getItem.mockReset().mockResolvedValue(null);
    mockedStorage.setItem.mockReset().mockResolvedValue(undefined);
  });

  it('defaults everything to on', async () => {
    await expect(loadReminderPrefs()).resolves.toEqual(DEFAULT_REMINDER_PREFS);
    expect(DEFAULT_REMINDER_PREFS).toEqual({
      remindersEnabled: true,
      classStartAlarmsEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
    });
  });

  it('recovers from garbage and partial payloads', () => {
    expect(parseReminderPrefs(null)).toBeNull();
    expect(parseReminderPrefs('{broken')).toBeNull();
    expect(parseReminderPrefs(JSON.stringify({}))).toEqual(
      DEFAULT_REMINDER_PREFS,
    );
    expect(
      parseReminderPrefs(
        JSON.stringify({ remindersEnabled: false, soundEnabled: 'yes' }),
      ),
    ).toEqual({ ...DEFAULT_REMINDER_PREFS, remindersEnabled: false });
  });

  it('round-trips through storage', async () => {
    const memory = new Map<string, string>();
    mockedStorage.setItem.mockImplementation(
      async (key: string, value: string) => {
        memory.set(key, value);
      },
    );
    mockedStorage.getItem.mockImplementation(
      async (key: string) => memory.get(key) ?? null,
    );
    await saveReminderPrefs({
      ...DEFAULT_REMINDER_PREFS,
      vibrationEnabled: false,
    });
    await expect(loadReminderPrefs()).resolves.toEqual({
      ...DEFAULT_REMINDER_PREFS,
      vibrationEnabled: false,
    });
  });
});
