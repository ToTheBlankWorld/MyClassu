import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadAttendancePrefs,
  parseAttendancePrefs,
  saveAttendancePrefs,
} from './attendancePrefs';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const mockedStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

/** Attendance display preferences: only honored options persist. */
describe('attendancePrefs', () => {
  beforeEach(() => {
    mockedStorage.getItem.mockReset().mockResolvedValue(null);
    mockedStorage.setItem.mockReset().mockResolvedValue(undefined);
  });

  it('defaults to a six-week trend', async () => {
    await expect(loadAttendancePrefs()).resolves.toEqual({ trendWeeks: 6 });
  });

  it('rejects unsupported trend windows', () => {
    expect(parseAttendancePrefs(JSON.stringify({ trendWeeks: 12 }))).toEqual({
      trendWeeks: 6,
    });
    expect(parseAttendancePrefs(JSON.stringify({ trendWeeks: 4 }))).toEqual({
      trendWeeks: 4,
    });
    expect(parseAttendancePrefs('bogus')).toBeNull();
    expect(parseAttendancePrefs(null)).toBeNull();
  });

  it('round-trips a valid choice', async () => {
    const memory = new Map<string, string>();
    mockedStorage.setItem.mockImplementation(
      async (key: string, value: string) => {
        memory.set(key, value);
      },
    );
    mockedStorage.getItem.mockImplementation(
      async (key: string) => memory.get(key) ?? null,
    );
    await saveAttendancePrefs({ trendWeeks: 8 });
    await expect(loadAttendancePrefs()).resolves.toEqual({ trendWeeks: 8 });
  });
});
