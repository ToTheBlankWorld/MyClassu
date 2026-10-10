jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import {
  addCourse,
  addSession,
  deleteSession,
  findOverlaps,
  parseStoredTimetable,
  serializeTimetable,
  updateSession,
  validateCourseInput,
  validateSessionInput,
} from './timetableStore';
import { timetable as bundled } from '../data/timetable';

/** Editable timetable store: validation, CRUD, overlaps, (de)serialization. */
describe('validateSessionInput', () => {
  const valid = {
    courseId: 'course-mech3271',
    weekday: 'monday' as const,
    startTime: '10:00',
    endTime: '10:50',
  };

  it('accepts a well-formed session', () => {
    expect(validateSessionInput(bundled, valid)).toEqual([]);
  });

  it('rejects unknown courses, bad weekdays, and bad times', () => {
    expect(
      validateSessionInput(bundled, { ...valid, courseId: 'nope' }),
    ).not.toHaveLength(0);
    expect(
      validateSessionInput(bundled, { ...valid, weekday: 'funday' as never }),
    ).not.toHaveLength(0);
    expect(
      validateSessionInput(bundled, { ...valid, startTime: '25:00' }),
    ).not.toHaveLength(0);
    expect(
      validateSessionInput(bundled, {
        ...valid,
        startTime: '10:50',
        endTime: '10:50',
      }),
    ).toEqual(['End time must be after start time.']);
    expect(
      validateSessionInput(bundled, {
        ...valid,
        startTime: '11:00',
        endTime: '10:00',
      }),
    ).toEqual(['End time must be after start time.']);
  });

  it('validates new courses', () => {
    expect(validateCourseInput({ code: 'CS101', title: 'Intro' })).toEqual([]);
    expect(validateCourseInput({ code: '  ', title: 'Intro' })).toEqual([
      'Course code is required.',
    ]);
  });
});

describe('addSession / updateSession / deleteSession', () => {
  const input = {
    courseId: 'course-mech3271',
    weekday: 'saturday' as const,
    startTime: '09:00',
    endTime: '09:50',
    room: 'ICT / 999',
  };

  it('adds a session with a fresh stable ID and keeps the source intact', () => {
    const before = bundled.sessions.length;
    const { timetable, session } = addSession(bundled, input);
    expect(timetable.sessions).toHaveLength(before + 1);
    expect(session.id).toMatch(/^session-custom-/);
    expect(session.room).toBe('ICT / 999');
    expect(bundled.sessions).toHaveLength(before);
    expect(session.instructor).toBeUndefined();
  });

  it('rejects invalid input without mutating', () => {
    expect(() => addSession(bundled, { ...input, endTime: '09:00' })).toThrow();
  });

  it('updates a session in place, preserving its ID', () => {
    const target = bundled.sessions[0];
    const next = updateSession(bundled, target.id, {
      courseId: target.courseId,
      weekday: target.weekday,
      startTime: '10:00',
      endTime: '11:50',
      room: 'ICT / 777',
    });
    const updated = next.sessions.find(session => session.id === target.id);
    expect(updated?.endTime).toBe('11:50');
    expect(updated?.room).toBe('ICT / 777');
    expect(next.sessions).toHaveLength(bundled.sessions.length);
  });

  it('clears room/faculty when emptied', () => {
    const target = bundled.sessions[0];
    const next = updateSession(bundled, target.id, {
      courseId: target.courseId,
      weekday: target.weekday,
      startTime: target.startTime,
      endTime: target.endTime,
      room: '   ',
    });
    expect(
      next.sessions.find(session => session.id === target.id)?.room,
    ).toBeUndefined();
  });

  it('throws for unknown session IDs', () => {
    expect(() =>
      updateSession(bundled, 'nope', { ...input, weekday: 'monday' }),
    ).toThrow('Session not found.');
    expect(() => deleteSession(bundled, 'nope')).toThrow('Session not found.');
  });

  it('deletes by ID without touching courses or other sessions', () => {
    const target = bundled.sessions[0];
    const next = deleteSession(bundled, target.id);
    expect(next.sessions).toHaveLength(bundled.sessions.length - 1);
    expect(next.sessions.some(session => session.id === target.id)).toBe(false);
    expect(next.courses).toHaveLength(bundled.courses.length);
  });

  it('adds a course once and reuses it for sessions', () => {
    const { timetable: withCourse, course } = addCourse(bundled, {
      code: 'CS9999',
      title: 'New Subject',
    });
    expect(course.id).toMatch(/^course-custom-/);
    const { timetable } = addSession(withCourse, {
      courseId: course.id,
      weekday: 'friday',
      startTime: '16:00',
      endTime: '16:50',
    });
    expect(
      timetable.sessions.some(session => session.courseId === course.id),
    ).toBe(true);
  });
});

describe('findOverlaps', () => {
  it('detects an intersecting session without merging by course code', () => {
    // Monday 10:00–10:50 MECH3271 exists in the bundled timetable.
    const overlaps = findOverlaps(bundled, 'monday', '10:30', '11:30');
    expect(overlaps.map(entry => entry.sessionId)).toContain(
      'session-mech3271-mon-1000',
    );
  });

  it('treats back-to-back sessions as non-overlapping', () => {
    expect(findOverlaps(bundled, 'monday', '10:50', '11:00')).toEqual([]);
  });

  it('ignores the session being edited', () => {
    expect(
      findOverlaps(
        bundled,
        'monday',
        '10:00',
        '10:50',
        'session-mech3271-mon-1000',
      ),
    ).toEqual([]);
  });

  it('finds nothing on empty days and rejects bad ranges', () => {
    expect(findOverlaps(bundled, 'saturday', '10:00', '11:00')).toEqual([]);
    expect(findOverlaps(bundled, 'monday', '11:00', '10:00')).toEqual([]);
  });
});

describe('serializeTimetable / parseStoredTimetable', () => {
  it('round-trips through storage JSON', () => {
    expect(parseStoredTimetable(serializeTimetable(bundled))).toEqual(bundled);
  });

  it('falls back to null on garbage, versions, and shapes', () => {
    expect(parseStoredTimetable(null)).toBeNull();
    expect(parseStoredTimetable('not json')).toBeNull();
    expect(parseStoredTimetable(JSON.stringify({ version: 999 }))).toBeNull();
    expect(
      parseStoredTimetable(
        JSON.stringify({
          version: 1,
          timezone: 'x',
          courses: [],
          sessions: [{}],
        }),
      ),
    ).toBeNull();
    expect(
      parseStoredTimetable(
        JSON.stringify({
          version: 1,
          timezone: 'Asia/Kolkata',
          courses: [],
          sessions: [
            {
              id: 's',
              courseId: 'c',
              weekday: 'funday',
              startTime: '10:00',
              endTime: '10:50',
            },
          ],
        }),
      ),
    ).toBeNull();
  });
});
