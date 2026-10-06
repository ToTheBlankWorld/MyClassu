import { timetable } from '../data/timetable';
import { createTimetableService, timetableService } from './timetableService';
import { TimetableValidationError } from '../engine/timetableEngine';

/**
 * The bound service is what screens will consume — these tests pin the
 * app-facing behavior over the bundled timetable.
 */

describe('timetableService (bound to the bundled timetable)', () => {
  it('evaluates in the timetable timezone, never the device timezone', () => {
    expect(timetableService.timezone).toBe('Asia/Kolkata');
  });

  it('answers the canonical next-class questions', () => {
    // Monday 13:00 IST → the 14:00 class
    expect(
      timetableService.getNextClass(new Date('2026-10-05T07:30:00Z'))?.course
        .code,
    ).toBe('CSEN3141');
    // Friday 16:00 IST → Monday
    expect(
      timetableService.getNextClass(new Date('2026-10-09T10:30:00Z'))?.dateKey,
    ).toBe('2026-10-12');
  });

  it('returns the current class while it runs', () => {
    const current = timetableService.getCurrentClass(
      new Date('2026-10-05T08:50:00Z'),
    );
    expect(current?.course.code).toBe('CSEN3141'); // 14:20 IST
  });

  it('validates the bundled data eagerly on construction', () => {
    expect(() => timetableService).not.toThrow();
  });

  it('throws on malformed data instead of misbehaving later', () => {
    const broken = {
      ...timetable,
      sessions: [
        {
          id: 'broken',
          courseId: timetable.courses[0].id,
          weekday: 'monday' as const,
          startTime: '25:00',
          endTime: '26:00',
        },
      ],
    };
    expect(() => createTimetableService(broken)).toThrow(
      TimetableValidationError,
    );
  });
});
