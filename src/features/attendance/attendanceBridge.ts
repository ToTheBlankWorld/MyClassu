import { NativeModules } from 'react-native';
import type {
  AttendanceDecisionInput,
  LocalAttendanceRecord,
} from './attendance';

/**
 * Typed wrapper around the native Attendance module (the single local
 * attendance database). Graceful off-Android: every call degrades instead
 * of crashing — reads resolve empty, writes throw a clear error.
 */

interface AttendanceNative {
  submitAttendance(decision: unknown): Promise<LocalAttendanceRecord>;
  getAttendance(): Promise<LocalAttendanceRecord[]>;
  getAttendanceForOccurrence(
    sessionId: string,
    dateKey: string,
  ): Promise<LocalAttendanceRecord | null>;
  getUnsyncedAttendance(): Promise<LocalAttendanceRecord[]>;
  markAttendanceSynced(recordIds: string[]): Promise<{ marked: number }>;
  clearAttendance(): Promise<boolean>;
}

const native = NativeModules.Attendance as AttendanceNative | undefined;

export const isAttendanceBridgeAvailable = (): boolean => native != null;

const unavailable = (): never => {
  throw new Error('Attendance native module is unavailable on this platform.');
};

export async function submitAttendanceDecision(
  input: AttendanceDecisionInput,
): Promise<LocalAttendanceRecord> {
  if (!native) {
    throw unavailable();
  }
  return native.submitAttendance(input);
}

export async function getAttendanceRecords(): Promise<LocalAttendanceRecord[]> {
  if (!native) {
    return [];
  }
  return native.getAttendance();
}

export async function getAttendanceForOccurrence(
  sessionId: string,
  dateKey: string,
): Promise<LocalAttendanceRecord | null> {
  if (!native) {
    return null;
  }
  return native.getAttendanceForOccurrence(sessionId, dateKey);
}

export async function getUnsyncedAttendance(): Promise<
  LocalAttendanceRecord[]
> {
  if (!native) {
    return [];
  }
  return native.getUnsyncedAttendance();
}

export async function markAttendanceSynced(
  recordIds: string[],
): Promise<{ marked: number }> {
  if (!native) {
    throw unavailable();
  }
  return native.markAttendanceSynced(recordIds);
}

/** Debug builds only (native refuses in release). */
export async function clearAttendance(): Promise<boolean> {
  if (!native) {
    throw unavailable();
  }
  return native.clearAttendance();
}
