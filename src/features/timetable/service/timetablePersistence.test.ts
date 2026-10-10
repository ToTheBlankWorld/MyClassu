import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadStoredTimetable,
  resetTimetable,
  saveTimetable,
  TIMETABLE_STORAGE_KEY,
} from './timetableStore';
import { timetable as bundled } from '../data/timetable';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const mockedStorage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

/** Storage round-trip with an in-memory AsyncStorage double. */
describe('timetable persistence', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    mockedStorage.getItem.mockImplementation(
      async (key: string) => memory.get(key) ?? null,
    );
    mockedStorage.setItem.mockImplementation(
      async (key: string, value: string) => {
        memory.set(key, value);
      },
    );
    mockedStorage.removeItem.mockImplementation(async (key: string) => {
      memory.delete(key);
    });
  });

  it('returns null when nothing is stored', async () => {
    memory.clear();
    await expect(loadStoredTimetable()).resolves.toBeNull();
  });

  it('round-trips a custom timetable and resets to bundled', async () => {
    await saveTimetable(bundled);
    expect(memory.has(TIMETABLE_STORAGE_KEY)).toBe(true);
    await expect(loadStoredTimetable()).resolves.toEqual(bundled);
    await resetTimetable();
    expect(memory.has(TIMETABLE_STORAGE_KEY)).toBe(false);
    await expect(loadStoredTimetable()).resolves.toBeNull();
  });

  it('survives malformed stored JSON by falling back', async () => {
    memory.set(TIMETABLE_STORAGE_KEY, '{broken');
    await expect(loadStoredTimetable()).resolves.toBeNull();
  });
});
