import type { ClassSession, Course } from '../../../domain/models';
import { timetable, type Timetable } from '../data/timetable';
import {
  TimetableValidationError,
  getClassesForDate,
  getClassesForDateKey,
  getClassesForDay,
  getClassesForWeek,
  getCurrentClass,
  getClassDuration,
  getMinutesSinceClassStarted,
  getMinutesUntilClass,
  getNextClass,
  getNextOccurrence,
  getScheduleStatus,
  getUpcomingClasses,
  isClassInProgress,
  validateTimetable,
} from './timetableEngine';

/**
 * Week of the tests: 2026-10-05 is a Monday.
 * IST is UTC+05:30 with no DST, so `ist()` builds instants directly.
 */
const ist = (m: number, d: number, hours: number, minutes: number) =>
  new Date(Date.UTC(2026, m - 1, d, hours - 5, minutes - 30));

const MON = ist(10, 5, 13, 0); // Monday 13:00 IST
const TUE = ist(10, 6, 13, 0);
const WED = ist(10, 7, 13, 0);
const SAT = ist(10, 10, 12, 0);
const SUN = ist(10, 11, 12, 0);

const codeOf = (
  value: ClassSession | { session: ClassSession } | null | undefined,
) => {
  const session =
    value == null ? null : 'session' in value ? value.session : value;
  return timetable.courses.find(course => course.id === session?.courseId)
    ?.code;
};

describe('daily schedules', () => {
  it('returns the four Monday classes in order', () => {
    expect(getClassesForDay(timetable, 'monday').map(codeOf)).toEqual([
      'MECH3271',
      '24CSEN4121',
      'CSEN3141',
      'VIVA3555',
    ]);
  });

  it('returns the three Tuesday classes in order', () => {
    expect(getClassesForDay(timetable, 'tuesday').map(codeOf)).toEqual([
      'MECH3271',
      'CSEN3141',
      '24CSEN4121',
    ]);
  });

  it('schedules the Wednesday lab as a 110-minute session', () => {
    const lab = getClassesForDay(timetable, 'wednesday').find(
      session => session.courseId === 'course-24csen4121p',
    );
    expect(lab).toBeDefined();
    expect(getClassDuration(lab!)).toBe(110);
  });

  it('schedules the Thursday Project/Guide session without room or instructor', () => {
    const first = getClassesForDay(timetable, 'thursday')[0];
    expect(first?.courseId).toBe('course-proj2999');
    expect(first?.room).toBeUndefined();
    expect(first?.instructor).toBeUndefined();
  });

  it('returns the single Friday class', () => {
    expect(getClassesForDay(timetable, 'friday').map(codeOf)).toEqual([
      'MECH2311',
    ]);
  });

  it('keeps per-session rooms for 24CSEN4121 (Mon ICT/305, Tue ICT/118)', () => {
    const monday = getClassesForDay(timetable, 'monday').find(
      session => session.courseId === 'course-24csen4121',
    );
    const tuesday = getClassesForDay(timetable, 'tuesday').find(
      session => session.courseId === 'course-24csen4121',
    );
    expect(monday?.room).toBe('ICT / 305');
    expect(tuesday?.room).toBe('ICT / 118');
  });
});

describe('current class ([start, end) convention)', () => {
  it('returns null before the first class of the day', () => {
    expect(getCurrentClass(timetable, ist(10, 5, 9, 0))).toBeNull();
  });

  it('considers the class CURRENT at the exact start minute', () => {
    const current = getCurrentClass(timetable, ist(10, 5, 14, 0));
    expect(codeOf(current)).toBe('CSEN3141');
  });

  it('considers the class CURRENT during the class', () => {
    const current = getCurrentClass(timetable, ist(10, 5, 14, 20));
    expect(codeOf(current)).toBe('CSEN3141');
  });

  it('considers the class FINISHED at the exact end minute (end exclusive)', () => {
    expect(getCurrentClass(timetable, ist(10, 5, 14, 50))).toBeNull();
  });

  it('returns null between classes', () => {
    expect(getCurrentClass(timetable, MON)).toBeNull();
  });

  it('treats the two-hour lab as current for its whole span', () => {
    expect(codeOf(getCurrentClass(timetable, ist(10, 7, 15, 49)))).toBe(
      '24CSEN4121P',
    );
    expect(getCurrentClass(timetable, ist(10, 7, 15, 50))).toBeNull();
  });
});

describe('next class', () => {
  it('returns a later class on the same day', () => {
    const next = getNextClass(timetable, MON);
    expect(codeOf(next)).toBe('CSEN3141');
    expect(next?.dateKey).toBe('2026-10-05');
  });

  it('skips the running class and returns the one after it', () => {
    const next = getNextClass(timetable, ist(10, 5, 14, 20));
    expect(codeOf(next)).toBe('VIVA3555');
  });

  it('moves to the next day after the last class', () => {
    const next = getNextClass(timetable, ist(10, 5, 16, 0));
    expect(codeOf(next)).toBe('MECH3271'); // Tuesday 10:00
    expect(next?.dateKey).toBe('2026-10-06');
  });

  it('wraps Friday evening to Monday morning', () => {
    const next = getNextClass(timetable, ist(10, 9, 16, 0)); // Friday
    expect(codeOf(next)).toBe('MECH3271'); // Monday 10:00
    expect(next?.dateKey).toBe('2026-10-12');
  });

  it('handles Saturday and Sunday (weekend → Monday)', () => {
    expect(codeOf(getNextClass(timetable, SAT))).toBe('MECH3271');
    expect(getNextClass(timetable, SAT)?.dateKey).toBe('2026-10-12');
    expect(codeOf(getNextClass(timetable, SUN))).toBe('MECH3271');
  });

  it('handles the midnight boundary (early morning → same day first class)', () => {
    const next = getNextClass(timetable, ist(10, 5, 0, 30)); // Monday 00:30 IST
    expect(codeOf(next)).toBe('MECH3271');
    expect(next?.dateKey).toBe('2026-10-05');
  });

  it('evaluates in Asia/Kolkata, not the UTC calendar (Sunday UTC → Monday IST)', () => {
    // 2026-10-04T20:00:00Z is 01:30 IST Monday — next class is Monday 10:00.
    const next = getNextClass(timetable, new Date('2026-10-04T20:00:00Z'));
    expect(codeOf(next)).toBe('MECH3271');
    expect(next?.dateKey).toBe('2026-10-05');
  });
});

describe('upcoming classes', () => {
  it('lists the next classes across days in order', () => {
    const upcoming = getUpcomingClasses(timetable, MON, undefined, 3);
    expect(upcoming.map(occurrence => codeOf(occurrence.session))).toEqual([
      'CSEN3141',
      'VIVA3555',
      'MECH3271',
    ]);
    expect(upcoming.map(occurrence => occurrence.dateKey)).toEqual([
      '2026-10-05',
      '2026-10-05',
      '2026-10-06',
    ]);
  });

  it('never includes a class that already started', () => {
    const upcoming = getUpcomingClasses(
      timetable,
      ist(10, 5, 14, 20),
      undefined,
      10,
    );
    expect(
      upcoming.every(
        o => o.startMinutes > 14 * 60 || o.dateKey !== '2026-10-05',
      ),
    ).toBe(true);
  });
});

describe('occurrence helpers', () => {
  it('computes class duration in minutes', () => {
    const normal = timetable.sessions.find(
      s => s.id === 'session-mech3271-mon-1000',
    );
    const lab = timetable.sessions.find(
      s => s.id === 'session-24csen4121p-wed-1400',
    );
    expect(getClassDuration(normal!)).toBe(50);
    expect(getClassDuration(lab!)).toBe(110);
  });

  it('computes minutes until a later class the same day', () => {
    const networks = timetable.sessions.find(
      s => s.id === 'session-csen3141-mon-1400',
    )!;
    expect(getMinutesUntilClass(timetable, networks, MON)).toBe(60);
  });

  it('computes minutes until a class the next day', () => {
    const tqm = timetable.sessions.find(
      s => s.id === 'session-mech3271-tue-1000',
    )!;
    expect(getMinutesUntilClass(timetable, tqm, MON)).toBe(21 * 60); // 21h
  });

  it('rolls a running class to next week for "minutes until"', () => {
    const networks = timetable.sessions.find(
      s => s.id === 'session-csen3141-mon-1400',
    )!;
    const during = ist(10, 5, 14, 20);
    expect(getMinutesUntilClass(timetable, networks, during)).toBe(
      7 * 24 * 60 + 14 * 60 - (14 * 60 + 20),
    );
  });

  it('computes minutes since class started (negative before start)', () => {
    const networks = timetable.sessions.find(
      s => s.id === 'session-csen3141-mon-1400',
    )!;
    expect(getMinutesSinceClassStarted(networks, ist(10, 5, 14, 20))).toBe(20);
    expect(getMinutesSinceClassStarted(networks, ist(10, 5, 14, 0))).toBe(0);
    expect(getMinutesSinceClassStarted(networks, MON)).toBe(-60);
  });

  it('returns null for minutes-since on a different weekday', () => {
    const networks = timetable.sessions.find(
      s => s.id === 'session-csen3141-mon-1400',
    )!;
    expect(getMinutesSinceClassStarted(networks, TUE)).toBeNull();
  });

  it('resolves the next occurrence with its concrete date', () => {
    const friday = timetable.sessions.find(
      s => s.id === 'session-mech2311-fri-1000',
    )!;
    const occurrence = getNextOccurrence(timetable, friday, WED);
    expect(occurrence.dateKey).toBe('2026-10-09');
    expect(occurrence.course.code).toBe('MECH2311');
  });

  it('reports in-progress correctly', () => {
    const networks = timetable.sessions.find(
      s => s.id === 'session-csen3141-mon-1400',
    )!;
    expect(isClassInProgress(networks, ist(10, 5, 14, 20))).toBe(true);
    expect(isClassInProgress(networks, ist(10, 5, 14, 50))).toBe(false);
    expect(isClassInProgress(networks, TUE)).toBe(false);
  });
});

describe('schedule status (independent of attendance)', () => {
  const networks = timetable.sessions.find(
    s => s.id === 'session-csen3141-mon-1400',
  )!;

  it('is upcoming before start, current during, completed after end', () => {
    expect(getScheduleStatus(networks, ist(10, 5, 13, 59))).toBe('upcoming');
    expect(getScheduleStatus(networks, ist(10, 5, 14, 0))).toBe('current');
    expect(getScheduleStatus(networks, ist(10, 5, 14, 50))).toBe('completed');
  });

  it('is upcoming on earlier days and completed on later days', () => {
    expect(getScheduleStatus(networks, SUN)).toBe('upcoming');
    expect(getScheduleStatus(networks, TUE)).toBe('completed');
  });
});

describe('week retrieval', () => {
  it('returns a monday-first week around the given date', () => {
    const week = getClassesForWeek(timetable, WED);
    expect(week.weekStart).toBe('2026-10-05');
    expect(week.days).toHaveLength(7);
    expect(week.days.map(day => day.weekday)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
    expect(week.days[0]?.dateKey).toBe('2026-10-05');
    expect(week.days[6]?.dateKey).toBe('2026-10-11');
  });

  it('carries the right classes per day of the week', () => {
    const week = getClassesForWeek(timetable, WED);
    expect(week.days[0]?.classes).toHaveLength(4);
    expect(week.days[2]?.classes.map(codeOf)).toEqual([
      'MECH3271',
      'MECH2311',
      '24CSEN4121P',
    ]);
    expect(week.days[4]?.classes).toHaveLength(1);
    expect(week.days[5]?.classes).toHaveLength(0);
    expect(week.days[6]?.classes).toHaveLength(0);
  });

  it('exposes date-key based access for attendance integration', () => {
    expect(getClassesForDateKey(timetable, '2026-10-09').map(codeOf)).toEqual([
      'MECH2311',
    ]);
    expect(getClassesForDate(timetable, ist(10, 9, 12, 0)).map(codeOf)).toEqual(
      ['MECH2311'],
    );
  });
});

describe('invalid data handling', () => {
  const baseCourse: Course = {
    id: 'course-x',
    code: 'X',
    title: 'X',
    instructor: undefined,
  };

  it('rejects an invalid class time', () => {
    const bad: Timetable = {
      timezone: 'Asia/Kolkata',
      courses: [baseCourse],
      sessions: [
        {
          id: 's1',
          courseId: 'course-x',
          weekday: 'monday',
          startTime: '9:00',
          endTime: '10:00',
        },
      ],
    };
    expect(validateTimetable(bad)).toHaveLength(1);
    expect(() => getClassesForDay(bad, 'monday')).toThrow(
      TimetableValidationError,
    );
    expect(() => getNextClass(bad, MON)).toThrow(TimetableValidationError);
  });

  it('rejects a session that ends before it starts', () => {
    const bad: Timetable = {
      timezone: 'Asia/Kolkata',
      courses: [baseCourse],
      sessions: [
        {
          id: 's1',
          courseId: 'course-x',
          weekday: 'monday',
          startTime: '14:00',
          endTime: '13:00',
        },
      ],
    };
    expect(validateTimetable(bad)).toHaveLength(1);
    expect(() => getClassDuration(bad.sessions[0])).toThrow(
      TimetableValidationError,
    );
  });

  it('rejects an invalid weekday at runtime', () => {
    expect(() => getClassesForDay(timetable, 'funday' as never)).toThrow(
      TimetableValidationError,
    );
  });

  it('rejects a session pointing at a missing course', () => {
    const orphan: Timetable = {
      timezone: 'Asia/Kolkata',
      courses: [],
      sessions: [
        {
          id: 's1',
          courseId: 'course-x',
          weekday: 'monday',
          startTime: '10:00',
          endTime: '11:00',
        },
      ],
    };
    expect(validateTimetable(orphan)).toHaveLength(1);
  });

  it('reports duplicate session ids', () => {
    const dup: Timetable = {
      timezone: 'Asia/Kolkata',
      courses: [baseCourse],
      sessions: [
        {
          id: 's1',
          courseId: 'course-x',
          weekday: 'monday',
          startTime: '10:00',
          endTime: '11:00',
        },
        {
          id: 's1',
          courseId: 'course-x',
          weekday: 'tuesday',
          startTime: '10:00',
          endTime: '11:00',
        },
      ],
    };
    expect(
      validateTimetable(dup).some(issue => issue.includes('Duplicate')),
    ).toBe(true);
  });
});

describe('empty timetable', () => {
  const empty: Timetable = {
    timezone: 'Asia/Kolkata',
    courses: [],
    sessions: [],
  };

  it('behaves gracefully everywhere', () => {
    expect(validateTimetable(empty)).toEqual([]);
    expect(getClassesForDay(empty, 'monday')).toEqual([]);
    expect(getCurrentClass(empty, MON)).toBeNull();
    expect(getNextClass(empty, MON)).toBeNull();
    expect(getUpcomingClasses(empty, MON)).toEqual([]);
    const week = getClassesForWeek(empty, MON);
    expect(week.days).toHaveLength(7);
    expect(week.days.every(day => day.classes.length === 0)).toBe(true);
  });
});
