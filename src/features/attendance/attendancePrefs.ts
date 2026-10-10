import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * Attendance display preferences. Only preferences the app genuinely
 * honors live here — currently the Stats trend window. Nothing here
 * creates, alters, or deletes attendance records.
 */

export const TREND_WEEK_OPTIONS = [4, 6, 8] as const;
export type TrendWeeks = (typeof TREND_WEEK_OPTIONS)[number];

export interface AttendancePrefs {
  trendWeeks: TrendWeeks;
}

const DEFAULTS: AttendancePrefs = { trendWeeks: 6 };
export const ATTENDANCE_PREFS_KEY = 'myclassu.attendancePrefs.v1';

function sanitize(raw: unknown): AttendancePrefs {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    TREND_WEEK_OPTIONS.includes(
      (raw as Record<string, unknown>).trendWeeks as TrendWeeks,
    )
  ) {
    return {
      trendWeeks: (raw as Record<string, unknown>).trendWeeks as TrendWeeks,
    };
  }
  return { ...DEFAULTS };
}

export function parseAttendancePrefs(
  raw: string | null,
): AttendancePrefs | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return sanitize(parsed);
  } catch {
    return null;
  }
}

export async function loadAttendancePrefs(): Promise<AttendancePrefs> {
  try {
    return (
      parseAttendancePrefs(
        await AsyncStorage.getItem(ATTENDANCE_PREFS_KEY),
      ) ?? {
        ...DEFAULTS,
      }
    );
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAttendancePrefs(
  prefs: AttendancePrefs,
): Promise<void> {
  await AsyncStorage.setItem(
    ATTENDANCE_PREFS_KEY,
    JSON.stringify(sanitize(prefs)),
  );
}

export function useAttendancePrefs(): {
  prefs: AttendancePrefs;
  ready: boolean;
  update: (patch: Partial<AttendancePrefs>) => Promise<void>;
} {
  const [prefs, setPrefs] = useState<AttendancePrefs>({ ...DEFAULTS });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAttendancePrefs()
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

  const update = useCallback(async (patch: Partial<AttendancePrefs>) => {
    setPrefs(previous => {
      const next = sanitize({ ...previous, ...patch });
      saveAttendancePrefs(next).catch(() => undefined);
      return next;
    });
  }, []);

  return { prefs, ready, update };
}
