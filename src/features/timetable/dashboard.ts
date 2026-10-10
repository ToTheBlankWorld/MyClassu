import type {
  ClassSession,
  ScheduleStatus,
  Weekday,
} from '../../domain/models';
import {
  getClassesForDate,
  getCurrentClass,
  getMinutesUntilClass,
  getNextClass,
  getScheduleStatus,
  getUpcomingClasses,
  type ResolvedOccurrence,
} from './engine/timetableEngine';
import type { Timetable } from './data/timetable';
import { timetable as initialTimetable } from './data/timetable';
import {
  addDays,
  formatDayLabel,
  formatTime12h,
  weekdayFromDateKey,
  zonedParts,
} from '../../utils/time';

/**
 * Pure Home-dashboard selector. Turns the timetable engine's answers for one
 * instant into everything the Home screen renders — headings, hero state,
 * today timeline, coming-up preview. No clocks, no React: pass `now` in.
 *
 * All data flows from the bundled timetable through the engine; nothing here
 * filters sessions itself, and nothing requires network access.
 */

export interface DashboardTimelineEntry {
  session: ClassSession;
  courseCode: string;
  courseTitle: string;
  room?: string;
  instructor?: string;
  startMinutes: number;
  endMinutes: number;
  startTimeLabel: string;
  endTimeLabel: string;
  status: ScheduleStatus;
}

export interface DashboardCurrentClass {
  courseCode: string;
  courseTitle: string;
  room?: string;
  instructor?: string;
  startMinutes: number;
  endMinutes: number;
  startTimeLabel: string;
  endTimeLabel: string;
  minutesRemaining: number;
  /** 0..1 progress through the class */
  progress: number;
}

export interface DashboardNextClass {
  courseCode: string;
  courseTitle: string;
  room?: string;
  instructor?: string;
  startMinutes: number;
  startTimeLabel: string;
  minutesUntil: number;
  /** Whether the next class is still today */
  isToday: boolean;
  /** "Today", "Tomorrow", or the weekday name */
  dayLabel: string;
  dateKey: string;
}

export interface DashboardUpcomingEntry {
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  room?: string;
  instructor?: string;
  startTimeLabel: string;
  dayLabel: string;
  dateKey: string;
}

export interface HomeDashboard {
  weekday: Weekday;
  dateKey: string;
  /** "Monday, 5 October" in the timetable zone */
  dateLabel: string;
  classesToday: number;
  /** Contextual heading, e.g. "In class now" / "Done for today" */
  heading: string;
  /** One-line factual status under the heading */
  summary: string;
  current: DashboardCurrentClass | null;
  next: DashboardNextClass | null;
  timeline: DashboardTimelineEntry[];
  upcomingPreview: DashboardUpcomingEntry[];
}

function dayLabelFor(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) {
    return 'Today';
  }
  if (dateKey === addDays(todayKey, 1)) {
    return 'Tomorrow';
  }
  const weekday = weekdayFromDateKey(dateKey);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function describeOccurrence(occurrence: ResolvedOccurrence) {
  const course = occurrence.course;
  return {
    courseCode: course.code,
    courseTitle: course.title,
    room: occurrence.session.room,
    instructor: occurrence.session.instructor ?? course.instructor,
  };
}

/** Build the complete Home dashboard for one instant. */
export function buildHomeDashboard(
  now: Date,
  timetable: Timetable = initialTimetable,
): HomeDashboard {
  const timeZone = timetable.timezone;
  const parts = zonedParts(now, timeZone);
  const todayKey = parts.dateKey;
  const dateLabel = formatDayLabel(now, timeZone);

  const currentOccurrence = getCurrentClass(timetable, now, timeZone);
  const nextOccurrence = getNextClass(timetable, now, timeZone);
  const todaySessions = getClassesForDate(timetable, now, timeZone);

  const timeline: DashboardTimelineEntry[] = todaySessions.map(session => {
    const start = parseMinutes(session.startTime);
    const end = parseMinutes(session.endTime);
    const course = timetable.courses.find(c => c.id === session.courseId);
    if (!course) {
      // Engine validation already rejects orphaned sessions; this is a guard.
      throw new Error(`Session ${session.id} references an unknown course`);
    }
    return {
      session,
      courseCode: course.code,
      courseTitle: course.title,
      room: session.room,
      instructor: session.instructor ?? course.instructor,
      startMinutes: start,
      endMinutes: end,
      startTimeLabel: formatTime12h(start),
      endTimeLabel: formatTime12h(end),
      status: getScheduleStatus(session, now, timeZone),
    };
  });

  const current: DashboardCurrentClass | null = currentOccurrence
    ? {
        ...describeOccurrence(currentOccurrence),
        startMinutes: currentOccurrence.startMinutes,
        endMinutes: currentOccurrence.endMinutes,
        startTimeLabel: formatTime12h(currentOccurrence.startMinutes),
        endTimeLabel: formatTime12h(currentOccurrence.endMinutes),
        minutesRemaining: currentOccurrence.endMinutes - parts.minutes,
        progress:
          (parts.minutes - currentOccurrence.startMinutes) /
          (currentOccurrence.endMinutes - currentOccurrence.startMinutes),
      }
    : null;

  const next: DashboardNextClass | null = nextOccurrence
    ? {
        ...describeOccurrence(nextOccurrence),
        startMinutes: nextOccurrence.startMinutes,
        startTimeLabel: formatTime12h(nextOccurrence.startMinutes),
        minutesUntil: getMinutesUntilClass(
          timetable,
          nextOccurrence.session,
          now,
          timeZone,
        ),
        isToday: nextOccurrence.dateKey === todayKey,
        dayLabel: dayLabelFor(nextOccurrence.dateKey, todayKey),
        dateKey: nextOccurrence.dateKey,
      }
    : null;

  const upcomingPreview: DashboardUpcomingEntry[] = getUpcomingClasses(
    timetable,
    now,
    timeZone,
    6,
  )
    .filter(occurrence => occurrence.dateKey !== todayKey)
    .slice(0, 3)
    .map(occurrence => ({
      ...describeOccurrence(occurrence),
      sessionId: occurrence.session.id,
      startTimeLabel: formatTime12h(occurrence.startMinutes),
      dayLabel: dayLabelFor(occurrence.dateKey, todayKey),
      dateKey: occurrence.dateKey,
    }));

  const classesToday = timeline.length;
  const hasUpcomingToday = timeline.some(entry => entry.status === 'upcoming');
  const allDone = classesToday > 0 && !hasUpcomingToday && !current;

  let heading: string;
  let summary: string;
  if (current) {
    heading = 'In class now';
    summary = `${classesToday} ${
      classesToday === 1 ? 'class' : 'classes'
    } today · until ${current.endTimeLabel}`;
  } else if (hasUpcomingToday && next) {
    heading = `Ready for ${next.courseCode}?`;
    summary = `${classesToday} ${
      classesToday === 1 ? 'class' : 'classes'
    } today · next at ${next.startTimeLabel}`;
  } else if (allDone && next) {
    heading = 'Done for today';
    summary = `All ${classesToday} done · next class ${next.dayLabel.toLowerCase()}`;
  } else if (next) {
    heading = 'A free day';
    summary = `No classes today · next class ${next.dayLabel.toLowerCase()}`;
  } else {
    heading = 'A free day';
    summary = 'No classes scheduled';
  }

  return {
    weekday: parts.weekday,
    dateKey: todayKey,
    dateLabel,
    classesToday,
    heading,
    summary,
    current,
    next,
    timeline,
    upcomingPreview,
  };
}

function parseMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error(`Invalid class time: ${value}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export type { ResolvedOccurrence };
