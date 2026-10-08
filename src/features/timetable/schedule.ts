import type {
  ClassSession,
  ScheduleStatus,
  Weekday,
} from '../../domain/models';
import { WEEKDAYS } from '../../domain/models';
import {
  getClassDuration,
  getClassesForDateKey,
  getCurrentClass,
  getNextClass,
  getScheduleStatus,
  type ResolvedOccurrence,
} from './engine/timetableEngine';
import type { Timetable } from './data/timetable';
import { timetable as initialTimetable } from './data/timetable';
import {
  addDays,
  dayNumberFromDateKey,
  formatDateKeyShort,
  formatDateKeyWeekday,
  formatTime12h,
  formatWeekRangeLabel,
  weekdayFromDateKey,
  weekdayIndex,
  zonedParts,
} from '../../utils/time';

/**
 * Pure Schedule selector. Turns the timetable engine's answers for one
 * instant + one selected local date into everything the Schedule screen
 * renders — week strip, day timeline with schedule states, empty-day
 * guidance. No clocks, no React: pass `now` in.
 *
 * Session data (times, rooms, instructors) always comes from the engine;
 * day-relative states (past → completed, future → upcoming) are plain
 * date-key comparisons, never re-filtered session logic.
 */

export interface ScheduleDay {
  dateKey: string;
  weekday: Weekday;
  /** e.g. "Mon" */
  weekdayShort: string;
  /** Day-of-month number, e.g. 6 */
  dayNumber: number;
  classCount: number;
  isToday: boolean;
  isSelected: boolean;
  accessibilityLabel: string;
}

export interface ScheduleTimelineEntry {
  session: ClassSession;
  courseCode: string;
  courseTitle: string;
  room?: string;
  instructor?: string;
  startMinutes: number;
  endMinutes: number;
  startTimeLabel: string;
  endTimeLabel: string;
  /** e.g. "50 min" / "1 h 50 min" */
  durationLabel: string;
  status: ScheduleStatus;
  /** 0..1 progress when this entry is the running class, else null */
  progress: number | null;
}

export interface ScheduleView {
  weekday: Weekday;
  todayKey: string;
  selectedKey: string;
  /** Monday ("YYYY-MM-DD") of the selected day's week */
  weekStartKey: string;
  /** e.g. "Oct 6 – Oct 12" */
  weekLabel: string;
  weekDays: ScheduleDay[];
  /** "Today" / "Tomorrow" / "Yesterday" / weekday name */
  dayHeading: string;
  /** e.g. "4 classes · 10:00 AM – 3:50 PM" or "No classes" */
  daySummary: string;
  timeline: ScheduleTimelineEntry[];
  /** Next class after now (for empty-day guidance), null when none */
  next: {
    courseTitle: string;
    dayLabel: string;
    startTimeLabel: string;
  } | null;
  /** Show the return-to-today control */
  showTodayButton: boolean;
}

function dayLabelFor(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) {
    return 'Today';
  }
  if (dateKey === addDays(todayKey, 1)) {
    return 'Tomorrow';
  }
  if (dateKey === addDays(todayKey, -1)) {
    return 'Yesterday';
  }
  return formatDateKeyWeekday(dateKey);
}

function parseMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error(`Invalid class time: ${value}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins} min`;
  }
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}

/** Build the complete Schedule view for one instant + selected date. */
export function buildScheduleView(
  now: Date,
  selectedDateKey: string | null,
  timetable: Timetable = initialTimetable,
): ScheduleView {
  const timeZone = timetable.timezone;
  const parts = zonedParts(now, timeZone);
  const todayKey = parts.dateKey;
  const selectedKey = selectedDateKey ?? todayKey;

  // Validate the selected key early (fail fast like the engine does).
  weekdayFromDateKey(selectedKey);

  const selectedIndex = weekdayIndex(weekdayFromDateKey(selectedKey));
  const weekStartKey = addDays(selectedKey, -selectedIndex);

  const currentOccurrence = getCurrentClass(timetable, now, timeZone);
  const nextOccurrence = getNextClass(timetable, now, timeZone);

  const weekDays: ScheduleDay[] = WEEKDAYS.map((weekday, index) => {
    const dateKey = addDays(weekStartKey, index);
    const classCount = getClassesForDateKey(timetable, dateKey).length;
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === selectedKey;
    const dayName = formatDateKeyWeekday(dateKey);
    const selected = isSelected ? ', selected' : '';
    const today = isToday ? ', today' : '';
    return {
      dateKey,
      weekday,
      weekdayShort: weekday.slice(0, 3).toUpperCase(),
      dayNumber: dayNumberFromDateKey(dateKey),
      classCount,
      isToday,
      isSelected,
      accessibilityLabel: `${dayName}, ${formatDateKeyShort(
        dateKey,
      )}${selected}${today}, ${classCount} ${
        classCount === 1 ? 'class' : 'classes'
      }`,
    };
  });

  const selectedSessions = getClassesForDateKey(timetable, selectedKey);
  const isPastDay = selectedKey < todayKey;
  const isFutureDay = selectedKey > todayKey;

  const timeline: ScheduleTimelineEntry[] = selectedSessions.map(session => {
    const start = parseMinutes(session.startTime);
    const end = parseMinutes(session.endTime);
    const course = timetable.courses.find(c => c.id === session.courseId);
    if (!course) {
      throw new Error(`Session ${session.id} references an unknown course`);
    }
    const status: ScheduleStatus = isPastDay
      ? 'completed'
      : isFutureDay
      ? 'upcoming'
      : getScheduleStatus(session, now, timeZone);
    const isRunning =
      !isPastDay &&
      !isFutureDay &&
      currentOccurrence?.session.id === session.id;
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
      durationLabel: formatDurationLabel(getClassDuration(session)),
      status,
      progress: isRunning ? (parts.minutes - start) / (end - start) : null,
    };
  });

  const dayHeading = dayLabelFor(selectedKey, todayKey);
  const daySummary =
    timeline.length === 0
      ? 'No classes'
      : `${timeline.length} ${timeline.length === 1 ? 'class' : 'classes'} · ${
          timeline[0].startTimeLabel
        } – ${timeline[timeline.length - 1].endTimeLabel}`;

  const next: ScheduleView['next'] = nextOccurrence
    ? {
        courseTitle: nextOccurrence.course.title,
        dayLabel: dayLabelFor(nextOccurrence.dateKey, todayKey),
        startTimeLabel: formatTime12h(nextOccurrence.startMinutes),
      }
    : null;

  return {
    weekday: parts.weekday,
    todayKey,
    selectedKey,
    weekStartKey,
    weekLabel: formatWeekRangeLabel(weekStartKey),
    weekDays,
    dayHeading,
    daySummary,
    timeline,
    next,
    showTodayButton: selectedKey !== todayKey,
  };
}

export type { ResolvedOccurrence };
