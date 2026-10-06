/**
 * Core domain models. These types are the shared language between features;
 * persistence (future local database) and UI both map onto them.
 *
 * Deliberate modeling rule: rooms and instructors belong to individual class
 * *sessions*, not to courses — the same course meets in different rooms on
 * different days.
 */

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Order used across the app when displaying weekdays. */
export const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export interface Course {
  id: string;
  /** University course code, e.g. "24CSEN4121" */
  code: string;
  title: string;
  /** Default instructor; individual sessions may override */
  instructor?: string;
}

/**
 * One recurring weekly meeting slot of a course. Room/instructor here are the
 * per-session truth (they may differ between sessions of the same course).
 */
export interface ClassSession {
  id: string;
  courseId: string;
  weekday: Weekday;
  /** Local university time, "HH:mm" 24h */
  startTime: string;
  /** Local university time, "HH:mm" 24h */
  endTime: string;
  /** e.g. "ICT / 305" */
  room?: string;
  instructor?: string;
}

/**
 * Attendance state — what the USER decided about an occurrence.
 * Deliberately separate from ScheduleStatus (where the class is in its
 * lifecycle): a class can be COMPLETED on the schedule but have no attendance
 * decision yet, and attendance never changes because time passed.
 */
export type AttendanceStatus =
  | 'attended'
  | 'skipped'
  | 'pending'
  | 'unconfirmed';

/**
 * Schedule lifecycle of a class occurrence, derived purely from time:
 * upcoming → current → completed. Uses the [start, end) interval convention.
 */
export type ScheduleStatus = 'upcoming' | 'current' | 'completed';

export type SkipReasonCategory =
  | 'sick'
  | 'personal'
  | 'event'
  | 'unprepared'
  | 'cancelled'
  | 'other';

/**
 * A concrete attendance decision for a specific occurrence of a session
 * (identified by classSessionId + local calendar date).
 */
export interface AttendanceRecord {
  id: string;
  classSessionId: string;
  /** Local calendar date, "YYYY-MM-DD" */
  date: string;
  status: AttendanceStatus;
  reasonCategory?: SkipReasonCategory;
  reasonText?: string;
  /** Instant the decision was marked, ISO 8601 */
  markedAt: string;
}

export interface AppSettings {
  /** IANA timezone the timetable lives in */
  timezone: string;
  /** Minutes before class start for the reminder */
  reminderMinutes: number;
  alarmEnabled: boolean;
  notificationEnabled: boolean;
  emailEnabled: boolean;
}
