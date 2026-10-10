import type { TimetableService } from '../timetable/service/timetableService';
import { formatTime12h } from '../../utils/time';

/**
 * JS-side reminder planning. Turns engine occurrences into concrete,
 * serializable reminder payloads for the native scheduler. All date math
 * uses the real timetable engine; the only hand-written math is the
 * occurrence wall-clock → UTC millis conversion, which is covered by
 * deterministic tests below.
 *
 * The university timezone is Asia/Kolkata (UTC+05:30, no DST — India has
 * never observed daylight saving). The fixed offset is asserted, not
 * assumed silently: any other timetable zone fails fast.
 */

export const REMINDER_LEAD_MINUTES = 5;
export const REMINDER_KIND = 'reminder-5min';
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const SUPPORTED_TIMEZONE = 'Asia/Kolkata';

export interface ClassReminderPayload {
  /** Deterministic: "<dateKey>|<sessionId>|reminder-5min" */
  id: string;
  dateKey: string;
  sessionId: string;
  subject: string;
  courseCode: string;
  startMinutes: number;
  endMinutes: number;
  /** e.g. "2:00 PM" */
  startLabel: string;
  /** e.g. "2:50 PM" — shown on the class-start alarm. */
  endLabel: string;
  /** Omitted when the session has no room (never "null"/"undefined"). */
  room?: string;
  instructor?: string;
  /** Absolute class-start instant, UTC millis. */
  classStart: number;
  classEnd: number;
  /** Absolute reminder instant (classStart − lead), UTC millis. */
  triggerAt: number;
}

export interface BuildReminderOptions {
  /**
   * Occurrences requested per horizon. Defaults to the timetable's session
   * count so EVERY session's nearest occurrence is covered — a fixed small
   * cap would silently drop sessions past the cutoff (and user-added
   * sessions push real timetables past any fixed number).
   */
  upcomingLimit?: number;
  /** Minutes before start (default 5). */
  leadMinutes?: number;
  /**
   * Extra week offsets evaluated in addition to `now` (default [+7d, +14d]).
   * The engine returns each session's nearest occurrence per call, so one
   * call only covers ~1 week; unioning horizons covers ~3 weeks of
   * reminders from a single app start. Deduplicated by stable ID.
   */
  horizonOffsetsDays?: number[];
}

const DEFAULT_HORIZONS_DAYS = [7, 14];

/**
 * Absolute UTC millis for a wall-clock instant in the university zone.
 * Exported for tests; throws outside the supported zone.
 */
export function occurrenceStartMillis(
  dateKey: string,
  startMinutes: number,
  timeZone: string,
): number {
  if (timeZone !== SUPPORTED_TIMEZONE) {
    throw new Error(`Unsupported timetable timezone: ${timeZone}`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  if (
    !Number.isInteger(startMinutes) ||
    startMinutes < 0 ||
    startMinutes >= 24 * 60
  ) {
    throw new Error(`Invalid start minutes: ${startMinutes}`);
  }
  const [, y, m, d] = match;
  return (
    Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0) +
    (startMinutes - IST_OFFSET_MINUTES) * 60_000
  );
}

/** Concrete reminder payloads for the next upcoming occurrences. */
export function buildReminderPayloads(
  now: Date,
  service: TimetableService,
  options: BuildReminderOptions = {},
): ClassReminderPayload[] {
  const {
    leadMinutes = REMINDER_LEAD_MINUTES,
    horizonOffsetsDays = DEFAULT_HORIZONS_DAYS,
    // Full weekly coverage per horizon: one nearest occurrence per session.
    upcomingLimit = service.sessionCount,
  } = options;
  if (service.sessionCount === 0 || upcomingLimit < 1) {
    return [];
  }
  const bases = [now, ...horizonOffsetsDays.map(days => shiftDays(now, days))];
  const seen = new Set<string>();
  const payloads: ClassReminderPayload[] = [];
  for (const base of bases) {
    for (const payload of planFromBase(base)) {
      if (!seen.has(payload.id)) {
        seen.add(payload.id);
        payloads.push(payload);
      }
    }
  }
  return payloads.sort((a, b) => a.triggerAt - b.triggerAt);

  function planFromBase(base: Date): ClassReminderPayload[] {
    return service.getUpcomingClasses(base, upcomingLimit).map(occurrence => {
      const classStart = occurrenceStartMillis(
        occurrence.dateKey,
        occurrence.startMinutes,
        service.timezone,
      );
      const classEnd = occurrenceStartMillis(
        occurrence.dateKey,
        occurrence.endMinutes,
        service.timezone,
      );
      const room = occurrence.session.room?.trim() || undefined;
      const instructor =
        occurrence.session.instructor ??
        occurrence.course.instructor ??
        undefined;
      return {
        id: `${occurrence.dateKey}|${occurrence.session.id}|${REMINDER_KIND}`,
        dateKey: occurrence.dateKey,
        sessionId: occurrence.session.id,
        subject: occurrence.course.title,
        courseCode: occurrence.course.code,
        startMinutes: occurrence.startMinutes,
        endMinutes: occurrence.endMinutes,
        startLabel: formatTime12h(occurrence.startMinutes),
        endLabel: formatTime12h(occurrence.endMinutes),
        ...(room ? { room } : {}),
        ...(instructor ? { instructor } : {}),
        classStart,
        classEnd,
        triggerAt: classStart - leadMinutes * 60_000,
      };
    });
  }
}

/** Shift an instant by whole days (UTC-based, DST-independent). */
function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
