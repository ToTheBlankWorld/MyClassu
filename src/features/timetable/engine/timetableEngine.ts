import type {
  ClassSession,
  Course,
  ScheduleStatus,
  Weekday,
} from '../../../domain/models';
import { WEEKDAYS } from '../../../domain/models';
import {
  addDays,
  daysBetweenWeekdays,
  parseHHmm,
  weekdayFromDateKey,
  weekdayIndex,
  zonedParts,
} from '../../../utils/time';
import type { Timetable } from '../data/timetable';
import { APP_TIMEZONE } from '../data/timetable';

/**
 * Timetable query engine — pure functions, no clocks, no UI.
 *
 * Conventions (documented in docs/ARCHITECTURE.md):
 * - Interval convention is [start, end): a class is CURRENT from its exact
 *   start minute (inclusive) to its exact end minute (exclusive). At 14:00 a
 *   14:00–14:50 class is current; at 14:50 it has finished.
 * - Every function takes an explicit `Date` instant and an IANA timezone
 *   (defaulting to the timetable's zone). Nothing calls `new Date()` here —
 *   the (impure) service layer does that.
 * - All wall-clock math happens on "minutes since midnight" in the target
 *   zone; multi-day offsets are handled with monday-first weekday indexes and
 *   whole-day shifts of local date keys.
 */

export class TimetableValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimetableValidationError';
  }
}

/** A session pinned to a concrete occurrence (a specific local date). */
export interface ResolvedOccurrence {
  session: ClassSession;
  course: Course;
  /** Local calendar date "YYYY-MM-DD" of the occurrence */
  dateKey: string;
  /** Minutes since midnight in the timetable zone */
  startMinutes: number;
  endMinutes: number;
}

export interface DaySchedule {
  weekday: Weekday;
  dateKey: string;
  classes: ClassSession[];
}

export interface WeekSchedule {
  /** Monday of the week, "YYYY-MM-DD" */
  weekStart: string;
  /** Always 7 entries, monday → sunday (weekend days may be empty) */
  days: DaySchedule[];
}

function sessionTimes(session: ClassSession): { start: number; end: number } {
  const start = parseHHmm(session.startTime);
  const end = parseHHmm(session.endTime);
  if (start === null || end === null) {
    throw new TimetableValidationError(
      `Session ${session.id} has an invalid time (${session.startTime}–${session.endTime})`,
    );
  }
  if (end <= start) {
    throw new TimetableValidationError(
      `Session ${session.id} must end after it starts (${session.startTime}–${session.endTime})`,
    );
  }
  return { start, end };
}

function assertKnownWeekday(weekday: string): Weekday {
  if (!WEEKDAYS.includes(weekday as Weekday)) {
    throw new TimetableValidationError(`Invalid weekday: ${weekday}`);
  }
  return weekday as Weekday;
}

function resolveCourse(timetable: Timetable, session: ClassSession): Course {
  const course = timetable.courses.find(
    candidate => candidate.id === session.courseId,
  );
  if (!course) {
    throw new TimetableValidationError(
      `Session ${session.id} references unknown course ${session.courseId}`,
    );
  }
  return course;
}

/** Validate a whole timetable; returns all problems (empty = valid). */
export function validateTimetable(timetable: Timetable): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const session of timetable.sessions) {
    try {
      assertKnownWeekday(session.weekday);
      sessionTimes(session);
      resolveCourse(timetable, session);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
    if (ids.has(session.id)) {
      issues.push(`Duplicate session id: ${session.id}`);
    }
    ids.add(session.id);
  }
  return issues;
}

function sortedSessions(
  timetable: Timetable,
  weekday: Weekday,
): ClassSession[] {
  const sessions = timetable.sessions.filter(
    session => session.weekday === weekday,
  );
  // Fail fast on malformed times even when the sort comparator never runs.
  sessions.forEach(sessionTimes);
  return [...sessions].sort(
    (a, b) => sessionTimes(a).start - sessionTimes(b).start,
  );
}

/** All sessions on a weekday (chronological). Throws on malformed data. */
export function getClassesForDay(
  timetable: Timetable,
  weekday: string,
): ClassSession[] {
  return sortedSessions(timetable, assertKnownWeekday(weekday));
}

/** Sessions of the weekday that the given instant falls on (in the zone). */
export function getClassesForDate(
  timetable: Timetable,
  date: Date,
  timeZone: string = APP_TIMEZONE,
): ClassSession[] {
  const { weekday } = zonedParts(date, timeZone);
  return sortedSessions(timetable, weekday);
}

/** Sessions of the weekday that a local calendar date falls on. */
export function getClassesForDateKey(
  timetable: Timetable,
  dateKey: string,
): ClassSession[] {
  return sortedSessions(timetable, weekdayFromDateKey(dateKey));
}

/** The week (monday-first) containing the given instant, all 7 days. */
export function getClassesForWeek(
  timetable: Timetable,
  date: Date,
  timeZone: string = APP_TIMEZONE,
): WeekSchedule {
  const { weekday, dateKey } = zonedParts(date, timeZone);
  const todayIndex = weekdayIndex(weekday);
  const weekStart = addDays(dateKey, -todayIndex);

  const days = WEEKDAYS.map((day, index) => ({
    weekday: day,
    dateKey: addDays(weekStart, index),
    classes: sortedSessions(timetable, day),
  }));

  return { weekStart, days };
}

/** The session happening at the given instant, or null between classes. */
export function getCurrentClass(
  timetable: Timetable,
  dateTime: Date,
  timeZone: string = APP_TIMEZONE,
): ResolvedOccurrence | null {
  const { weekday, minutes, dateKey } = zonedParts(dateTime, timeZone);
  for (const session of sortedSessions(timetable, weekday)) {
    const { start, end } = sessionTimes(session);
    if (start <= minutes && minutes < end) {
      return {
        session,
        course: resolveCourse(timetable, session),
        dateKey,
        startMinutes: start,
        endMinutes: end,
      };
    }
  }
  return null;
}

/** Occurrence on the nearest date strictly after `dateTime`'s start. */
export function getNextOccurrence(
  timetable: Timetable,
  session: ClassSession,
  dateTime: Date,
  timeZone: string = APP_TIMEZONE,
): ResolvedOccurrence {
  const { weekday, minutes, dateKey } = zonedParts(dateTime, timeZone);
  const { start, end } = sessionTimes(session);
  const sessionIndex = weekdayIndex(session.weekday);
  const todayIndex = weekdayIndex(weekday);

  let dayOffset = daysBetweenWeekdays(todayIndex, sessionIndex);
  const isToday = dayOffset === 0;
  if (isToday && minutes >= end) {
    // Today's occurrence is already over → the next one is next week.
    dayOffset += 7;
  }

  return {
    session,
    course: resolveCourse(timetable, session),
    dateKey: addDays(dateKey, dayOffset),
    startMinutes: start,
    endMinutes: end,
  };
}

/**
 * The next class that STARTS strictly after `dateTime`. Never returns a class
 * that already started (including one currently running); walks across
 * midnight, weekends and the Friday→Monday gap.
 */
export function getNextClass(
  timetable: Timetable,
  dateTime: Date,
  timeZone: string = APP_TIMEZONE,
): ResolvedOccurrence | null {
  const upcoming = getUpcomingClasses(timetable, dateTime, timeZone, 1);
  return upcoming[0] ?? null;
}

/**
 * The next `limit` class starts strictly after `dateTime`, across days.
 * A class that is currently running is not included (it started before now).
 */
export function getUpcomingClasses(
  timetable: Timetable,
  dateTime: Date,
  timeZone: string = APP_TIMEZONE,
  limit: number = 5,
): ResolvedOccurrence[] {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TimetableValidationError(`Invalid upcoming limit: ${limit}`);
  }

  const { weekday, minutes, dateKey } = zonedParts(dateTime, timeZone);
  const todayIndex = weekdayIndex(weekday);

  const candidates = timetable.sessions.map(session => {
    const { start } = sessionTimes(session);
    const sessionIndex = weekdayIndex(session.weekday);
    let dayOffset = daysBetweenWeekdays(todayIndex, sessionIndex);
    if (dayOffset === 0 && start <= minutes) {
      dayOffset = 7; // started today (running or finished) → next week
    }
    return { session, key: dayOffset * 24 * 60 + start, dayOffset, start };
  });

  candidates.sort((a, b) => a.key - b.key);

  return candidates.slice(0, limit).map(({ session, dayOffset, start }) => {
    const { end } = sessionTimes(session);
    return {
      session,
      course: resolveCourse(timetable, session),
      dateKey: addDays(dateKey, dayOffset),
      startMinutes: start,
      endMinutes: end,
    };
  });
}

/** True when the given instant falls inside [start, end) of the session's day. */
export function isClassInProgress(
  session: ClassSession,
  dateTime: Date,
  timeZone: string = APP_TIMEZONE,
): boolean {
  const { weekday, minutes } = zonedParts(dateTime, timeZone);
  if (weekday !== session.weekday) {
    return false;
  }
  const { start, end } = sessionTimes(session);
  return start <= minutes && minutes < end;
}

/** Duration of a session in minutes. */
export function getClassDuration(session: ClassSession): number {
  const { start, end } = sessionTimes(session);
  return end - start;
}

/**
 * Minutes from `dateTime` until the next start of this session that is
 * STRICTLY in the future. If the class is running right now, the next start
 * is next week (use getMinutesSinceClassStarted for the running class).
 */
export function getMinutesUntilClass(
  timetable: Timetable,
  session: ClassSession,
  dateTime: Date,
  timeZone: string = APP_TIMEZONE,
): number {
  const now = zonedParts(dateTime, timeZone);
  const occurrence = getNextOccurrence(timetable, session, dateTime, timeZone);

  const isTodayAndAlreadyStarted =
    occurrence.dateKey === now.dateKey &&
    occurrence.startMinutes <= now.minutes;

  const daysAhead = isTodayAndAlreadyStarted
    ? 7
    : dayDistance(now.dateKey, occurrence.dateKey);

  return daysAhead * 24 * 60 + occurrence.startMinutes - now.minutes;
}

/** Whole days between two local date keys (to is at or after from). */
function dayDistance(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T12:00:00Z`);
  const to = Date.parse(`${toKey}T12:00:00Z`);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

/**
 * Minutes since the session's start on the instant's own weekday.
 * Negative = not started yet, 0 = exactly now, positive = since start.
 * Null when the instant's weekday is not the session's weekday.
 */
export function getMinutesSinceClassStarted(
  session: ClassSession,
  dateTime: Date,
  timeZone: string = APP_TIMEZONE,
): number | null {
  const { weekday, minutes } = zonedParts(dateTime, timeZone);
  if (weekday !== session.weekday) {
    return null;
  }
  const { start } = sessionTimes(session);
  return minutes - start;
}

/**
 * Schedule status of the occurrence falling on the instant's local date:
 * 'upcoming' before start, 'current' within [start, end), 'completed' after.
 * For dates that are not the session's weekday: future dates are 'upcoming',
 * past dates are 'completed'.
 *
 * This is SCHEDULE state only — it is intentionally independent of attendance
 * (a completed class may still have no attendance decision).
 */
export function getScheduleStatus(
  session: ClassSession,
  dateTime: Date,
  timeZone: string = APP_TIMEZONE,
): ScheduleStatus {
  const { weekday, minutes } = zonedParts(dateTime, timeZone);
  if (weekday !== session.weekday) {
    const todayIndex = weekdayIndex(weekday);
    const sessionIndex = weekdayIndex(session.weekday);
    const daysUntilNext = daysBetweenWeekdays(todayIndex, sessionIndex);
    // If the last occurrence is closer behind than the next one is ahead,
    // treat the just-finished occurrence as the relevant one.
    const daysSinceLast = (7 - daysUntilNext) % 7;
    return daysSinceLast > 0 && daysSinceLast <= daysUntilNext
      ? 'completed'
      : 'upcoming';
  }
  const { start, end } = sessionTimes(session);
  if (minutes < start) {
    return 'upcoming';
  }
  if (minutes < end) {
    return 'current';
  }
  return 'completed';
}
