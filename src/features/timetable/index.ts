import type { ClassSession, Course } from '../../domain/models';
import type { Timetable } from './data/timetable';
import { courseOfSession, sessionsForWeekday } from './queries';
import { timetable as initialTimetable } from './data/timetable';

/**
 * Entry point for timetable feature consumers. The data currently comes from
 * the bundled initial timetable; a future stage swaps this for a local
 * repository without touching call sites.
 */

export function getTimetable(): Timetable {
  return initialTimetable;
}

export function getSessionsForWeekday(weekday: string): ClassSession[] {
  return sessionsForWeekday(initialTimetable, weekday);
}

export function getCourseOfSession(session: ClassSession): Course | undefined {
  return courseOfSession(initialTimetable, session);
}

export type { ClassSession, Course } from '../../domain/models';
export * from './engine/timetableEngine';
export * from './service/timetableService';
