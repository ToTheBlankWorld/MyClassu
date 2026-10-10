import {
  loadCourseMapping,
  loadSessionMapping,
  parseMapping,
  storeCourseMapping,
  storeSessionMapping,
} from './sessionMapping';

const mockMemory = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockMemory.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockMemory.delete(key);
  }),
}));

/** Session/course UUID mapping: sanitize, persist, reject guesses. */
describe('sessionMapping', () => {
  beforeEach(() => {
    mockMemory.clear();
  });

  it('starts empty and round-trips verified mappings', async () => {
    await expect(loadSessionMapping()).resolves.toEqual({});
    await storeSessionMapping('s1', '00000000-0000-4000-8000-000000000001');
    await expect(loadSessionMapping()).resolves.toEqual({
      s1: '00000000-0000-4000-8000-000000000001',
    });
    await storeCourseMapping('c1', '00000000-0000-4000-8000-000000000002');
    await expect(loadCourseMapping()).resolves.toEqual({
      c1: '00000000-0000-4000-8000-000000000002',
    });
  });

  it('refuses to store non-uuid values', async () => {
    await expect(storeSessionMapping('s9', 'not-a-uuid')).rejects.toThrow(
      'non-uuid',
    );
    await expect(storeCourseMapping('c9', '')).rejects.toThrow('non-uuid');
    await expect(loadSessionMapping()).resolves.toEqual({});
  });

  it('sanitizes malformed persisted payloads', () => {
    expect(parseMapping(null)).toBeNull();
    expect(parseMapping('garbage')).toBeNull();
    expect(
      parseMapping(
        JSON.stringify({
          good: '00000000-0000-4000-8000-000000000001',
          bad: 'guess',
          '': '00000000-0000-4000-8000-000000000002',
        }),
      ),
    ).toEqual({ good: '00000000-0000-4000-8000-000000000001' });
  });
});
