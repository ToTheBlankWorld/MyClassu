import {
  buildReminderPayloads,
  occurrenceStartMillis,
  REMINDER_LEAD_MINUTES,
} from './classReminders';
import { createTimetableService } from '../timetable/service/timetableService';
import type { ClassSession } from '../../domain/models';
import { timetable } from '../timetable/data/timetable';

/**
 * Reminder planning over the real bundled timetable + real engine. The
 * only hand-written math under test is the IST wall-clock conversion;
 * every occurrence comes from getUpcomingClasses, never from mocks.
 */
const service = createTimetableService(timetable);

const ist = (d: number, hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 9, d, hours - 5, minutes - 30));

describe('occurrenceStartMillis — Asia/Kolkata conversion', () => {
  it('maps 10:00 IST to 04:30 UTC', () => {
    expect(occurrenceStartMillis('2026-10-05', 10 * 60, 'Asia/Kolkata')).toBe(
      Date.UTC(2026, 9, 5, 4, 30),
    );
  });

  it('maps 14:00 IST to 08:30 UTC', () => {
    expect(occurrenceStartMillis('2026-10-05', 14 * 60, 'Asia/Kolkata')).toBe(
      Date.UTC(2026, 9, 5, 8, 30),
    );
  });

  it('crosses the UTC date boundary for early-morning classes', () => {
    // 00:05 IST Oct 6 == Oct 5 18:35 UTC.
    expect(occurrenceStartMillis('2026-10-06', 5, 'Asia/Kolkata')).toBe(
      Date.UTC(2026, 9, 5, 18, 35),
    );
  });

  it('rejects other timezones instead of silently miscomputing', () => {
    expect(() => occurrenceStartMillis('2026-10-05', 600, 'UTC')).toThrow();
  });

  it('rejects malformed input', () => {
    expect(() => occurrenceStartMillis('nope', 600, 'Asia/Kolkata')).toThrow();
    expect(() =>
      occurrenceStartMillis('2026-10-05', 24 * 60, 'Asia/Kolkata'),
    ).toThrow();
  });
});

describe('buildReminderPayloads — five-minute offset', () => {
  it('fires the first Monday reminder at 09:55 for the 10:00 class', () => {
    const payloads = buildReminderPayloads(ist(5, 8, 0), service);
    const first = payloads[0];
    expect(first.courseCode).toBe('MECH3271');
    expect(first.subject).toBe('Total Quality Management');
    expect(first.dateKey).toBe('2026-10-05');
    expect(first.classStart).toBe(Date.UTC(2026, 9, 5, 4, 30));
    expect(first.triggerAt).toBe(
      first.classStart - REMINDER_LEAD_MINUTES * 60_000,
    );
    expect(first.triggerAt).toBe(Date.UTC(2026, 9, 5, 4, 25));
    expect(first.startLabel).toBe('10:00 AM');
    expect(first.room).toBe('ICT / 331');
  });

  it('carries the display fields the class-start alarm needs', () => {
    const payloads = buildReminderPayloads(ist(5, 8, 0), service, {
      horizonOffsetsDays: [],
    });
    const acn = payloads.find(p => p.courseCode === 'CSEN3141');
    if (acn === undefined) {
      throw new Error('Expected an ACN reminder payload');
    }
    // One payload arms both the reminder and the class-start alarm.
    expect(acn.startLabel).toBe('2:00 PM');
    expect(acn.endLabel).toBe('2:50 PM');
    expect(acn.classStart).toBe(Date.UTC(2026, 9, 5, 8, 30));
    expect(acn.classEnd - acn.classStart).toBe(50 * 60_000);
    expect(acn.instructor).toBe('Tadi Srinivas');
    // Reminder vs class-start identities for this occurrence differ.
    const reminderId = `${acn.dateKey}|${acn.sessionId}|reminder-5min`;
    const alarmId = `${acn.dateKey}|${acn.sessionId}|class-start`;
    expect(acn.id).toBe(reminderId);
    expect(reminderId).not.toBe(alarmId);
  });

  it('uses deterministic duplicate-proof identifiers', () => {
    const first = buildReminderPayloads(ist(5, 8, 0), service);
    const second = buildReminderPayloads(ist(5, 8, 0), service);
    expect(first.map(p => p.id)).toEqual(second.map(p => p.id));
    expect(first[0].id).toBe(
      '2026-10-05|session-mech3271-mon-1000|reminder-5min',
    );
    // Unique per occurrence across the whole batch.
    expect(new Set(first.map(p => p.id)).size).toBe(first.length);
  });

  it('omits the room key for room-less sessions', () => {
    const payloads = buildReminderPayloads(ist(8, 8, 30), service);
    const project = payloads.find(p => p.courseCode === 'PROJ2999');
    expect(project).toBeDefined();
    expect('room' in (project as object)).toBe(false);
    expect(project?.instructor).toBeUndefined();
  });

  it('preserves the long lab duration in absolute timestamps', () => {
    const payloads = buildReminderPayloads(ist(7, 12, 0), service);
    const lab = payloads.find(p => p.courseCode === '24CSEN4121P');
    if (lab === undefined) {
      throw new Error('Expected a lab reminder payload');
    }
    expect(lab.classEnd - lab.classStart).toBe(110 * 60_000);
    expect(lab.triggerAt).toBe(lab.classStart - 5 * 60_000);
  });

  it('covers the weekend gap with Monday occurrences', () => {
    const payloads = buildReminderPayloads(ist(10, 12, 0), service);
    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads[0].dateKey).toBe('2026-10-12');
    expect(payloads[0].startLabel).toBe('10:00 AM');
  });

  it('returns an empty schedule for an empty timetable', () => {
    const empty = createTimetableService({
      timezone: 'Asia/Kolkata',
      courses: [],
      sessions: [],
    });
    expect(buildReminderPayloads(ist(5, 8, 0), empty)).toEqual([]);
  });

  it('respects a custom upcoming limit', () => {
    const payloads = buildReminderPayloads(ist(5, 8, 0), service, {
      upcomingLimit: 2,
      horizonOffsetsDays: [],
    });
    expect(payloads).toHaveLength(2);
  });

  it('unions horizons for multi-week coverage without duplicates', () => {
    const payloads = buildReminderPayloads(ist(5, 8, 0), service);
    const ids = payloads.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // ~3 weeks of school days: well beyond one weekly cycle of 14.
    expect(payloads.length).toBeGreaterThan(28);
    // Sorted chronologically by trigger.
    const triggers = payloads.map(p => p.triggerAt);
    expect([...triggers].sort((a, b) => a - b)).toEqual(triggers);
    // Coverage reaches the third school week (Mon Oct 19 onward).
    expect(payloads.some(p => p.dateKey >= '2026-10-19')).toBe(true);
  });

  it('keeps single-horizon behavior when horizons are disabled', () => {
    const payloads = buildReminderPayloads(ist(5, 8, 0), service, {
      horizonOffsetsDays: [],
    });
    // One occurrence per weekly session from Monday 08:00.
    expect(payloads).toHaveLength(14);
  });

  it('covers every session when the timetable exceeds any fixed cap', () => {
    // 25 non-overlapping Monday sessions: a fixed per-horizon cap (the old
    // default covered 20) would silently drop the last five alarms.
    const courseId = timetable.courses[0].id;
    const pad = (n: number): string => String(n).padStart(2, '0');
    const sessions: ClassSession[] = Array.from({ length: 25 }, (_, i) => {
      const startHour = Math.floor(i / 2);
      const startMinute = i % 2 === 0 ? '00' : '30';
      const endHour = startMinute === '00' ? startHour : startHour + 1;
      const endMinute = startMinute === '00' ? '30' : '00';
      return {
        id: `synth-${i}`,
        courseId,
        weekday: 'monday',
        startTime: `${pad(startHour)}:${startMinute}`,
        endTime: `${pad(endHour)}:${endMinute}`,
      };
    });
    const big = createTimetableService({
      timezone: 'Asia/Kolkata',
      courses: timetable.courses,
      sessions,
    });
    expect(big.sessionCount).toBe(25);
    const payloads = buildReminderPayloads(ist(5, 8, 0), big, {
      horizonOffsetsDays: [],
    });
    expect(payloads).toHaveLength(25);
    expect(new Set(payloads.map(p => p.sessionId)).size).toBe(25);
  });
});
