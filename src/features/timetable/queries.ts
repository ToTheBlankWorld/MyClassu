import type { ClassSession, Course } from '../../domain/models';
import { parseHHmm } from '../../utils/time';
import type { Timetable } from './data/timetable';

/** Look up a course by id. */
export function courseById(
  timetable: Timetable,
  courseId: string,
): Course | undefined {
  return timetable.courses.find(course => course.id === courseId);
}

/** Sort sessions chronologically by their start time ("HH:mm"). */
export function sortSessions(sessions: ClassSession[]): ClassSession[] {
  return [...sessions].sort((a, b) => {
    const aStart = parseHHmm(a.startTime) ?? 0;
    const bStart = parseHHmm(b.startTime) ?? 0;
    return aStart - bStart;
  });
}

/** All sessions scheduled on a given weekday, chronologically sorted. */
export function sessionsForWeekday(
  timetable: Timetable,
  weekday: string,
): ClassSession[] {
  return sortSessions(
    timetable.sessions.filter(session => session.weekday === weekday),
  );
}

/** Resolve the course of a session (every session must reference a course). */
export function courseOfSession(
  timetable: Timetable,
  session: ClassSession,
): Course | undefined {
  return courseById(timetable, session.courseId);
}
