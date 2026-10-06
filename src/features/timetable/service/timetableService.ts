import type {
  ClassSession,
  ScheduleStatus,
  Weekday,
} from '../../../domain/models';
import type { Timetable } from '../data/timetable';
import { timetable as initialTimetable } from '../data/timetable';
import {
  TimetableValidationError,
  getClassesForDate,
  getClassesForDateKey,
  getClassesForDay,
  getClassesForWeek,
  getCurrentClass,
  getMinutesSinceClassStarted,
  getMinutesUntilClass,
  getNextClass,
  getNextOccurrence,
  getScheduleStatus,
  getUpcomingClasses,
  getClassDuration,
  isClassInProgress,
  validateTimetable,
  type ResolvedOccurrence,
  type WeekSchedule,
} from '../engine/timetableEngine';

/**
 * Bound, UI-facing timetable API. The app talks to THIS object — screens must
 * never filter the raw session arrays themselves. All date/time math lives in
 * the pure engine beneath it.
 *
 * Signatures accept an optional `Date` for convenience (defaulting to "now"),
 * but never a timezone: the timetable always evaluates in its own zone.
 */
export interface TimetableService {
  /** IANA timezone the timetable is evaluated in */
  readonly timezone: string;
  getClassesForDay(weekday: Weekday): ClassSession[];
  getClassesForDate(date: Date): ClassSession[];
  /** Classes for the whole monday-first week containing `date`. */
  getClassesForWeek(date: Date): WeekSchedule;
  /** Local calendar date access, e.g. for attendance integration. */
  getClassesForDateKey(dateKey: string): ClassSession[];
  getCurrentClass(dateTime?: Date): ResolvedOccurrence | null;
  getNextClass(dateTime?: Date): ResolvedOccurrence | null;
  getUpcomingClasses(dateTime?: Date, limit?: number): ResolvedOccurrence[];
  getNextOccurrence(session: ClassSession, dateTime?: Date): ResolvedOccurrence;
  isClassInProgress(session: ClassSession, dateTime?: Date): boolean;
  getClassDuration(session: ClassSession): number;
  getMinutesUntilClass(session: ClassSession, dateTime?: Date): number;
  getMinutesSinceClassStarted(
    session: ClassSession,
    dateTime?: Date,
  ): number | null;
  getScheduleStatus(session: ClassSession, dateTime?: Date): ScheduleStatus;
}

export function createTimetableService(timetable: Timetable): TimetableService {
  // Fail fast on malformed bundled data instead of misbehaving at runtime.
  const issues = validateTimetable(timetable);
  if (issues.length > 0) {
    throw new TimetableValidationError(
      `Invalid timetable data: ${issues.join('; ')}`,
    );
  }

  const timeZone = timetable.timezone;

  return {
    timezone: timeZone,
    getClassesForDay: weekday => getClassesForDay(timetable, weekday),
    getClassesForDate: date => getClassesForDate(timetable, date, timeZone),
    getClassesForWeek: date => getClassesForWeek(timetable, date, timeZone),
    getClassesForDateKey: dateKey => getClassesForDateKey(timetable, dateKey),
    getCurrentClass: (dateTime = new Date()) =>
      getCurrentClass(timetable, dateTime, timeZone),
    getNextClass: (dateTime = new Date()) =>
      getNextClass(timetable, dateTime, timeZone),
    getUpcomingClasses: (dateTime = new Date(), limit = 5) =>
      getUpcomingClasses(timetable, dateTime, timeZone, limit),
    getNextOccurrence: (session, dateTime = new Date()) =>
      getNextOccurrence(timetable, session, dateTime, timeZone),
    isClassInProgress: (session, dateTime = new Date()) =>
      isClassInProgress(session, dateTime, timeZone),
    getClassDuration: session => getClassDuration(session),
    getMinutesUntilClass: (session, dateTime = new Date()) =>
      getMinutesUntilClass(timetable, session, dateTime, timeZone),
    getMinutesSinceClassStarted: (session, dateTime = new Date()) =>
      getMinutesSinceClassStarted(session, dateTime, timeZone),
    getScheduleStatus: (session, dateTime = new Date()) =>
      getScheduleStatus(session, dateTime, timeZone),
  };
}

/** The app-wide timetable service over the bundled local timetable. */
export const timetableService: TimetableService =
  createTimetableService(initialTimetable);
