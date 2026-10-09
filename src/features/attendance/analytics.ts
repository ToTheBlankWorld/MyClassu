import type { LocalAttendanceRecord } from './attendance';
import { addDays, weekdayFromDateKey, weekdayIndex } from '../../utils/time';

/**
 * Attendance analytics — pure domain functions over decided records.
 *
 * Semantics (the rules, stated once):
 * - Only `attended` / `skipped` records count. Anything else (including
 *   malformed records) is ignored, never guessed.
 * - Upcoming classes are NEVER in any denominator: no record means no
 *   decision, and passing time alone never invents a miss.
 * - One record per occurrence ID; duplicates collapse to the newest write.
 * - All date grouping uses the record's Asia/Kolkata `dateKey`
 *   (already a wall-clock date — no timezone math here).
 * - Percentage = attended / decided, rounded to whole percent. No
 *   decided records → null (the UI shows an intentional empty state,
 *   never NaN or a misleading 0%).
 */

export interface AttendanceSummary {
  attended: number;
  missed: number;
  decided: number;
  /** Whole percent, or null when nothing is decided yet. */
  percentage: number | null;
}

export interface SubjectAttendance {
  courseCode: string;
  subject: string;
  attended: number;
  missed: number;
  decided: number;
  percentage: number | null;
}

export type HistoryFilter = 'all' | 'attended' | 'missed';

export interface HistoryEntry {
  id: string;
  dateKey: string;
  subject: string;
  courseCode: string;
  status: 'attended' | 'missed';
  reasonLabel: string | null;
  customReason: string | null;
}

export interface ReasonStat {
  value: string;
  label: string;
  count: number;
  /** Share of missed classes, whole percent. */
  percentOfMissed: number;
}

export interface TrendWeek {
  weekStartKey: string;
  /** e.g. "Oct 5" (Monday of the week). */
  label: string;
  attended: number;
  missed: number;
  decided: number;
  scheduled: number;
  percentage: number | null;
}

interface DecidedRecord {
  id: string;
  dateKey: string;
  courseCode: string;
  subject: string;
  status: 'attended' | 'skipped';
  reasonCategory?: string;
  reasonText?: string;
  markedAtMillis: number;
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Keep only well-formed decided records; newest write wins per ID. */
function decidedRecords(records: LocalAttendanceRecord[]): DecidedRecord[] {
  const byId = new Map<string, DecidedRecord>();
  for (const record of records) {
    if (!record || typeof record.id !== 'string' || record.id === '') {
      continue;
    }
    if (
      typeof record.dateKey !== 'string' ||
      !DATE_KEY_PATTERN.test(record.dateKey)
    ) {
      continue;
    }
    if (record.status !== 'attended' && record.status !== 'skipped') {
      continue;
    }
    const candidate: DecidedRecord = {
      id: record.id,
      dateKey: record.dateKey,
      courseCode:
        typeof record.courseCode === 'string' ? record.courseCode : '',
      subject: typeof record.subject === 'string' ? record.subject : '',
      status: record.status,
      reasonCategory:
        typeof record.reasonCategory === 'string' &&
        record.reasonCategory !== ''
          ? record.reasonCategory
          : undefined,
      reasonText:
        typeof record.reasonText === 'string' && record.reasonText.trim() !== ''
          ? record.reasonText.trim()
          : undefined,
      markedAtMillis:
        typeof record.markedAtMillis === 'number' ? record.markedAtMillis : 0,
    };
    const existing = byId.get(candidate.id);
    if (!existing || candidate.markedAtMillis >= existing.markedAtMillis) {
      byId.set(candidate.id, candidate);
    }
  }
  return [...byId.values()];
}

function percentage(attended: number, decided: number): number | null {
  if (decided === 0) {
    return null;
  }
  return Math.round((attended / decided) * 100);
}

/** Overall summary across all decided records. */
export function summarizeAttendance(
  records: LocalAttendanceRecord[],
): AttendanceSummary {
  const decided = decidedRecords(records);
  const attended = decided.filter(
    record => record.status === 'attended',
  ).length;
  const missed = decided.length - attended;
  return {
    attended,
    missed,
    decided: decided.length,
    percentage: percentage(attended, decided.length),
  };
}

/**
 * Per-subject breakdown, grouped by course code (never merged by
 * look-alike names). Weakest first, then most missed — the subjects that
 * need attention surface at the top.
 */
export function groupBySubject(
  records: LocalAttendanceRecord[],
): SubjectAttendance[] {
  const groups = new Map<
    string,
    { subject: string; attended: number; missed: number }
  >();
  for (const record of decidedRecords(records)) {
    const key = record.courseCode !== '' ? record.courseCode : record.subject;
    const entry = groups.get(key) ?? {
      subject: record.subject,
      attended: 0,
      missed: 0,
    };
    if (record.subject !== '' && entry.subject === '') {
      entry.subject = record.subject;
    }
    if (record.status === 'attended') {
      entry.attended += 1;
    } else {
      entry.missed += 1;
    }
    groups.set(key, entry);
  }
  return [...groups.entries()]
    .map(([courseCode, entry]) => ({
      courseCode,
      subject: entry.subject,
      attended: entry.attended,
      missed: entry.missed,
      decided: entry.attended + entry.missed,
      percentage: percentage(entry.attended, entry.attended + entry.missed),
    }))
    .sort((a, b) => {
      const pa = a.percentage ?? -1;
      const pb = b.percentage ?? -1;
      if (pa !== pb) {
        return pa - pb;
      }
      return b.missed - a.missed;
    });
}

/** Chronological history (newest first), optionally filtered by decision. */
export function buildHistory(
  records: LocalAttendanceRecord[],
  filter: HistoryFilter = 'all',
): HistoryEntry[] {
  return decidedRecords(records)
    .filter(record => {
      if (filter === 'attended') {
        return record.status === 'attended';
      }
      if (filter === 'missed') {
        return record.status === 'skipped';
      }
      return true;
    })
    .map(
      (record): HistoryEntry => ({
        id: record.id,
        dateKey: record.dateKey,
        subject: record.subject,
        courseCode: record.courseCode,
        status: record.status === 'attended' ? 'attended' : 'missed',
        reasonLabel:
          record.status === 'skipped'
            ? reasonLabelFor(record.reasonCategory)
            : null,
        customReason:
          record.status === 'skipped' ? record.reasonText ?? null : null,
      }),
    )
    .sort((a, b) => {
      if (a.dateKey !== b.dateKey) {
        return a.dateKey < b.dateKey ? 1 : -1;
      }
      return a.id < b.id ? -1 : 1;
    });
}

const REASON_LABELS: Record<string, string> = {
  study: 'Study',
  work: 'Work',
  personal: 'Personal',
  health: 'Health',
  overslept: 'Overslept',
  entertainment: 'Entertainment',
  other: 'Other',
};

function reasonLabelFor(value: string | undefined): string {
  if (!value) {
    return 'No reason given';
  }
  return REASON_LABELS[value] ?? value;
}

/** Missed-class reasons with counts and shares of all missed classes. */
export function breakdownReasons(
  records: LocalAttendanceRecord[],
): ReasonStat[] {
  const missed = decidedRecords(records).filter(
    record => record.status === 'skipped',
  );
  const counts = new Map<string, number>();
  for (const record of missed) {
    const key = record.reasonCategory ?? '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: reasonLabelFor(value === '' ? undefined : value),
      count,
      percentOfMissed:
        missed.length === 0 ? 0 : Math.round((count / missed.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Weekly trend for the `weeks` Monday-first weeks ending with the week
 * containing `todayKey`. `classesForDateKey` supplies scheduled counts
 * from the timetable engine (eligible-class context); weeks with no
 * decided classes keep `percentage: null` and render as "no data", never
 * as 0%.
 */
export function buildWeeklyTrend(
  records: LocalAttendanceRecord[],
  todayKey: string,
  weeks: number,
  classesForDateKey: (dateKey: string) => number,
): TrendWeek[] {
  if (!DATE_KEY_PATTERN.test(todayKey)) {
    throw new Error(`Invalid today key: ${todayKey}`);
  }
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new Error(`Invalid week count: ${weeks}`);
  }
  const decided = decidedRecords(records);
  const byDate = new Map<string, { attended: number; missed: number }>();
  for (const record of decided) {
    const entry = byDate.get(record.dateKey) ?? { attended: 0, missed: 0 };
    if (record.status === 'attended') {
      entry.attended += 1;
    } else {
      entry.missed += 1;
    }
    byDate.set(record.dateKey, entry);
  }
  const thisMonday = addDays(
    todayKey,
    -weekdayIndex(weekdayFromDateKey(todayKey)),
  );
  const result: TrendWeek[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(thisMonday, -w * 7);
    let attended = 0;
    let missed = 0;
    let scheduled = 0;
    for (let d = 0; d < 7; d++) {
      const dateKey = addDays(weekStart, d);
      const day = byDate.get(dateKey);
      if (day) {
        attended += day.attended;
        missed += day.missed;
      }
      scheduled += classesForDateKey(dateKey);
    }
    const total = attended + missed;
    result.push({
      weekStartKey: weekStart,
      label: shortLabel(weekStart),
      attended,
      missed,
      decided: total,
      scheduled,
      percentage: percentage(attended, total),
    });
  }
  return result;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function shortLabel(dateKey: string): string {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return `${SHORT_MONTHS[Number(match[2]) - 1]} ${Number(match[3])}`;
}
