import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isValidEmail,
  loadReportPrefs,
  parseReportPrefs,
  saveReportPrefs,
  DEFAULT_REPORT_PREFS,
} from './reportPrefs';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const mockedStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

/** Report preferences: validation, sanitizing, persistence. */
describe('reportPrefs', () => {
  beforeEach(() => {
    mockedStorage.getItem.mockReset().mockResolvedValue(null);
    mockedStorage.setItem.mockReset().mockResolvedValue(undefined);
  });

  it('defaults to reports off with no recipient', async () => {
    await expect(loadReportPrefs()).resolves.toEqual(DEFAULT_REPORT_PREFS);
    expect(DEFAULT_REPORT_PREFS).toEqual({
      dailyEnabled: false,
      weeklyEnabled: false,
      email: '',
      sendWhenEmpty: false,
    });
  });

  it('validates email addresses', () => {
    expect(isValidEmail('student@example.com')).toBe(true);
    expect(isValidEmail('a.b+tag@sub.example.co')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@tld')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('drops invalid emails instead of storing them', () => {
    expect(
      parseReportPrefs(JSON.stringify({ email: 'bogus', dailyEnabled: true })),
    ).toEqual({ ...DEFAULT_REPORT_PREFS, dailyEnabled: true });
    expect(parseReportPrefs('bogus')).toBeNull();
    expect(parseReportPrefs(null)).toBeNull();
  });

  it('round-trips a valid configuration', async () => {
    const memory = new Map<string, string>();
    mockedStorage.setItem.mockImplementation(
      async (key: string, value: string) => {
        memory.set(key, value);
      },
    );
    mockedStorage.getItem.mockImplementation(
      async (key: string) => memory.get(key) ?? null,
    );
    await saveReportPrefs({
      dailyEnabled: true,
      weeklyEnabled: true,
      email: 'student@example.com',
      sendWhenEmpty: true,
    });
    await expect(loadReportPrefs()).resolves.toEqual({
      dailyEnabled: true,
      weeklyEnabled: true,
      email: 'student@example.com',
      sendWhenEmpty: true,
    });
  });
});
