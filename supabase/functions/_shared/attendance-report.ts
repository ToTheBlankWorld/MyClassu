/**
 * Shared attendance-report builders. Dependency-free on purpose: this file
 * is imported by the Deno Edge Function AND unit-tested under Jest, so it
 * must not import npm packages, Deno APIs, or app modules.
 *
 * Rules (mirroring the on-device analytics semantics):
 * - Only decided classes (attended/skipped) enter percentages.
 * - Undecided classes are listed separately and never counted as missed.
 * - Empty days produce a concise no-classes report (or silence, by pref).
 * - Zero records and 0% attendance are described differently.
 * - Idempotency keys: `daily:<userId>:<dateKey>` / `weekly:<userId>:<weekStart>`.
 */

export const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** "YYYY-MM-DD" calendar date of an instant in Asia/Kolkata. */
export function istDateKey(nowMillis: number): string {
  const shifted = new Date(nowMillis + IST_OFFSET_MINUTES * 60_000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Cron expression (UTC) that fires at 18:00 Asia/Kolkata daily. */
export const DAILY_REPORT_CRON_UTC = '30 12 * * *';

export type ClassDecision = 'attended' | 'skipped' | 'undecided';

export interface ReportClass {
  subject: string;
  courseCode: string;
  timeLabel: string;
  room?: string;
  status: ClassDecision;
  reasonLabel?: string;
  customReason?: string;
}

export interface WeekToDate {
  attended: number;
  missed: number;
}

export interface DailyReportInput {
  userId: string;
  dateKey: string;
  dateLabel: string;
  classes: ReportClass[];
  weekToDate: WeekToDate;
}

export interface BuiltReport {
  idempotencyKey: string;
  subject: string;
  text: string;
}

function percent(attended: number, decided: number): number | null {
  if (decided === 0) {
    return null;
  }
  return Math.round((attended / decided) * 100);
}

function classLine(entry: ReportClass): string {
  const marker =
    entry.status === 'attended'
      ? '[x]'
      : entry.status === 'skipped'
      ? '[ ]'
      : '[?]';
  const room = entry.room ? ` · ${entry.room}` : '';
  let line = `${marker} ${entry.subject} (${entry.courseCode}) — ${entry.timeLabel}${room}`;
  if (entry.status === 'skipped' && entry.reasonLabel) {
    line += ` — ${entry.reasonLabel}`;
    if (entry.customReason) {
      line += `: ${entry.customReason}`;
    }
  }
  return line;
}

/** Daily 6 PM report. Returns null when there is nothing to send. */
export function buildDailyReport(input: DailyReportInput): BuiltReport | null {
  const { userId, dateKey, dateLabel, classes, weekToDate } = input;
  const idempotencyKey = `daily:${userId}:${dateKey}`;
  if (classes.length === 0) {
    return {
      idempotencyKey,
      subject: `MyClassu: no classes on ${dateLabel}`,
      text: [
        `Attendance for ${dateLabel}`,
        '',
        'No classes were scheduled today — nothing to mark, nothing missed.',
      ].join('\n'),
    };
  }
  const decided = classes.filter(entry => entry.status !== 'undecided');
  const attended = decided.filter(entry => entry.status === 'attended').length;
  const missed = decided.length - attended;
  const pending = classes.filter(entry => entry.status === 'undecided');
  const rate = percent(attended, decided.length);
  const weekDecided = weekToDate.attended + weekToDate.missed;
  const weekRate = percent(weekToDate.attended, weekDecided);

  const lines = [
    `Attendance for ${dateLabel}`,
    '',
    ...classes.map(classLine),
    '',
    decided.length === 0
      ? `Decided: 0 of ${classes.length} (all still pending — none counted as missed).`
      : `Decided: ${decided.length} of ${classes.length} — ${attended} attended, ${missed} missed (${rate}%).`,
  ];
  if (pending.length > 0) {
    lines.push(
      `Still undecided: ${pending.map(entry => entry.subject).join(', ')}.`,
    );
  }
  lines.push(
    weekDecided === 0
      ? 'Week to date: no decided classes yet.'
      : `Week to date: ${weekToDate.attended} attended, ${weekToDate.missed} missed (${weekRate}%).`,
  );
  return {
    idempotencyKey,
    subject:
      decided.length === 0
        ? `MyClassu: ${dateLabel} — no decisions yet`
        : `MyClassu: ${dateLabel} — ${rate}% (${attended}/${decided.length})`,
    text: lines.join('\n'),
  };
}

export interface WeeklyReportInput {
  userId: string;
  weekStartKey: string;
  weekLabel: string;
  attended: number;
  missed: number;
  subjects: Array<{ courseCode: string; attended: number; missed: number }>;
  reasons: Array<{ label: string; count: number }>;
  previous?: { attended: number; missed: number } | null;
}

export function buildWeeklyReport(input: WeeklyReportInput): BuiltReport {
  const { userId, weekStartKey, weekLabel, attended, missed } = input;
  const decided = attended + missed;
  const rate = percent(attended, decided);
  const lines = [
    `Weekly attendance for ${weekLabel}`,
    '',
    decided === 0
      ? 'No decided classes this week — distinct from 0% attendance.'
      : `Decided: ${decided} — ${attended} attended, ${missed} missed (${rate}%).`,
  ];
  if (input.subjects.length > 0) {
    lines.push('', 'By subject:');
    for (const subject of input.subjects) {
      const total = subject.attended + subject.missed;
      const subjectRate = percent(subject.attended, total);
      lines.push(
        `- ${subject.courseCode}: ${subject.attended}/${total} (${subjectRate}%)`,
      );
    }
  }
  if (input.reasons.length > 0) {
    lines.push('', 'Missed because:');
    for (const reason of input.reasons) {
      lines.push(`- ${reason.label}: ${reason.count}`);
    }
  }
  if (input.previous) {
    const prevDecided = input.previous.attended + input.previous.missed;
    if (prevDecided > 0 && decided > 0) {
      const prevRate = percent(input.previous.attended, prevDecided);
      const delta = (rate ?? 0) - (prevRate ?? 0);
      const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      lines.push(
        '',
        `Previous week: ${prevRate}% — ${direction} by ${Math.abs(
          delta,
        )} points.`,
      );
    } else {
      lines.push('', 'Previous week: not enough data to compare.');
    }
  }
  return {
    idempotencyKey: `weekly:${userId}:${weekStartKey}`,
    subject:
      decided === 0
        ? `MyClassu: week of ${weekLabel} — no decided classes`
        : `MyClassu: week of ${weekLabel} — ${rate}% (${attended}/${decided})`,
    text: lines.join('\n'),
  };
}
