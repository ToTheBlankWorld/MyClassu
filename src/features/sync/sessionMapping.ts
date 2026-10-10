import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Durable local→server UUID mapping. Local timetable IDs are stable
 * strings (bundled or `custom-…`); server rows use uuid primary keys.
 * Every mapping entry is written only after the corresponding server
 * upsert succeeds, so a crash can never record a guess — keys are
 * deterministic (the local IDs themselves), values are never invented.
 */

export const SESSION_MAPPING_KEY = 'myclassu.sessionMapping.v1';
export const COURSE_MAPPING_KEY = 'myclassu.courseMapping.v1';

export type UuidMap = Record<string, string>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeMap(raw: unknown): UuidMap {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const clean: UuidMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key !== '' && typeof value === 'string' && UUID_PATTERN.test(value)) {
      clean[key] = value;
    }
  }
  return clean;
}

async function loadMap(key: string): Promise<UuidMap> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return {};
    }
    return sanitizeMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function saveMap(key: string, map: UuidMap): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(map));
}

export async function loadSessionMapping(): Promise<UuidMap> {
  return loadMap(SESSION_MAPPING_KEY);
}

export async function loadCourseMapping(): Promise<UuidMap> {
  return loadMap(COURSE_MAPPING_KEY);
}

/** Record one verified mapping (persisted immediately — crash-safe). */
export async function storeSessionMapping(
  localSessionId: string,
  serverUuid: string,
): Promise<void> {
  if (!UUID_PATTERN.test(serverUuid)) {
    throw new Error('Refusing to store a non-uuid server session id.');
  }
  const map = await loadSessionMapping();
  map[localSessionId] = serverUuid;
  await saveMap(SESSION_MAPPING_KEY, map);
}

/** Record one verified course mapping (persisted immediately). */
export async function storeCourseMapping(
  localCourseId: string,
  serverUuid: string,
): Promise<void> {
  if (!UUID_PATTERN.test(serverUuid)) {
    throw new Error('Refusing to store a non-uuid server course id.');
  }
  const map = await loadCourseMapping();
  map[localCourseId] = serverUuid;
  await saveMap(COURSE_MAPPING_KEY, map);
}

/** Replace the whole session map (used for pruning stale entries). */
export async function saveSessionMapping(map: UuidMap): Promise<void> {
  await saveMap(SESSION_MAPPING_KEY, sanitizeMap(map));
}

export function parseMapping(raw: string | null): UuidMap | null {
  if (!raw) {
    return null;
  }
  try {
    return sanitizeMap(JSON.parse(raw));
  } catch {
    return null;
  }
}
