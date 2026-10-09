import type {
  AttendanceRecord,
  AttendanceStatus,
  SkipReasonCategory,
} from '../../domain/models';

/**
 * Local attendance record — mirrors the native `AttendanceStore` fields
 * (the single authoritative local database) and maps onto the domain
 * `AttendanceRecord` plus the Supabase `attendance_records` columns.
 */

export interface LocalAttendanceRecord {
  id: string;
  sessionId: string;
  dateKey: string;
  courseCode: string;
  subject: string;
  classStartMillis: number;
  classEndMillis: number;
  status: 'attended' | 'skipped';
  reasonCategory?: string;
  reasonText?: string;
  markedAtMillis: number;
  updatedAtMillis: number;
  synced: boolean;
}

export interface AttendanceDecisionInput {
  sessionId: string;
  dateKey: string;
  status: 'attended' | 'skipped';
  courseCode?: string;
  subject?: string;
  classStartMillis?: number;
  classEndMillis?: number;
  reasonCategory?: string;
  reasonText?: string;
}

/** Reason choices shown to the user (DB shared-default vocabulary). */
export const SKIP_REASON_OPTIONS: ReadonlyArray<{
  value: SkipReasonCategory;
  label: string;
}> = [
  { value: 'study', label: 'Study' },
  { value: 'work', label: 'Work' },
  { value: 'personal', label: 'Personal' },
  { value: 'health', label: 'Health' },
  { value: 'overslept', label: 'Overslept' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
];

export function isKnownReasonCategory(value: string | undefined): boolean {
  return (
    value !== undefined &&
    SKIP_REASON_OPTIONS.some(option => option.value === value)
  );
}

/** Deterministic occurrence identity shared with the native store. */
export function attendanceRecordId(sessionId: string, dateKey: string): string {
  return `${sessionId}|${dateKey}`;
}

/** Local record → domain record (for UI/analytics layers). */
export function toDomainRecord(local: LocalAttendanceRecord): AttendanceRecord {
  const status: AttendanceStatus =
    local.status === 'attended' ? 'attended' : 'skipped';
  return {
    id: local.id,
    classSessionId: local.sessionId,
    date: local.dateKey,
    status,
    ...(local.reasonCategory
      ? { reasonCategory: local.reasonCategory as SkipReasonCategory }
      : {}),
    ...(local.reasonText ? { reasonText: local.reasonText } : {}),
    markedAt: new Date(local.markedAtMillis).toISOString(),
  };
}
