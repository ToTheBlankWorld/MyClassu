import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * Attendance report preferences. Every option here is honored:
 * - daily/weekly toggles gate server-side delivery (via email_settings).
 * - email is validated before it is ever stored or sent anywhere.
 * - noClassesReport chooses between a concise report and silence on
 *   days with no scheduled classes.
 */

export interface ReportPrefs {
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  email: string;
  sendWhenEmpty: boolean;
}

export const DEFAULT_REPORT_PREFS: ReportPrefs = {
  dailyEnabled: false,
  weeklyEnabled: false,
  email: '',
  sendWhenEmpty: false,
};

export const REPORT_PREFS_KEY = 'myclassu.reportPrefs.v1';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function sanitize(raw: unknown): ReportPrefs {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_REPORT_PREFS };
  }
  const candidate = raw as Record<string, unknown>;
  const email =
    typeof candidate.email === 'string' && isValidEmail(candidate.email)
      ? candidate.email.trim()
      : '';
  return {
    dailyEnabled: candidate.dailyEnabled === true,
    weeklyEnabled: candidate.weeklyEnabled === true,
    email,
    sendWhenEmpty:
      candidate.sendWhenEmpty === undefined
        ? DEFAULT_REPORT_PREFS.sendWhenEmpty
        : candidate.sendWhenEmpty === true,
  };
}

export function parseReportPrefs(raw: string | null): ReportPrefs | null {
  if (!raw) {
    return null;
  }
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function loadReportPrefs(): Promise<ReportPrefs> {
  try {
    return (
      parseReportPrefs(await AsyncStorage.getItem(REPORT_PREFS_KEY)) ?? {
        ...DEFAULT_REPORT_PREFS,
      }
    );
  } catch {
    return { ...DEFAULT_REPORT_PREFS };
  }
}

export async function saveReportPrefs(prefs: ReportPrefs): Promise<void> {
  await AsyncStorage.setItem(REPORT_PREFS_KEY, JSON.stringify(sanitize(prefs)));
}

export function useReportPrefs(): {
  prefs: ReportPrefs;
  ready: boolean;
  update: (patch: Partial<ReportPrefs>) => Promise<void>;
} {
  const [prefs, setPrefs] = useState<ReportPrefs>({ ...DEFAULT_REPORT_PREFS });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadReportPrefs()
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

  const update = useCallback(async (patch: Partial<ReportPrefs>) => {
    setPrefs(previous => {
      const next = sanitize({ ...previous, ...patch });
      saveReportPrefs(next).catch(() => undefined);
      return next;
    });
  }, []);

  return { prefs, ready, update };
}
