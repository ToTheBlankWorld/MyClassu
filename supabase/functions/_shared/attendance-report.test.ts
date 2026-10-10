import {
  buildDailyReport,
  buildWeeklyReport,
  DAILY_REPORT_CRON_UTC,
  istDateKey,
} from './attendance-report';

/** Pure report builders: calculations, idempotency, timezone, wording. */
describe('istDateKey', () => {
  it('resolves the Asia/Kolkata calendar date across the UTC midnight boundary', () => {
    // 2026-10-08 18:35 UTC == 2026-10-09 00:05 IST.
    expect(istDateKey(Date.UTC(2026, 9, 8, 18, 35))).toBe('2026-10-09');
    expect(istDateKey(Date.UTC(2026, 9, 8, 10, 0))).toBe('2026-10-08');
  });

  it('pins the 6 PM IST schedule to a UTC cron expression', () => {
    // 18:00 IST minus 05:30 = 12:30 UTC.
    expect(DAILY_REPORT_CRON_UTC).toBe('30 12 * * *');
  });
});

describe('buildDailyReport', () => {
  it('summarizes decided classes and separates undecided ones', () => {
    const report = buildDailyReport({
      userId: 'user-1',
      dateKey: '2026-10-12',
      dateLabel: 'Monday, 12 October',
      classes: [
        {
          subject: 'Total Quality Management',
          courseCode: 'MECH3271',
          timeLabel: '10:00 AM – 10:50 AM',
          room: 'ICT / 331',
          status: 'attended',
        },
        {
          subject: 'Networks',
          courseCode: 'CSEN3141',
          timeLabel: '2:00 PM – 2:50 PM',
          room: 'ICT / 606',
          status: 'skipped',
          reasonLabel: 'Health',
        },
        {
          subject: 'Lab',
          courseCode: '24CSEN4121P',
          timeLabel: '3:00 PM – 3:50 PM',
          status: 'undecided',
        },
      ],
      weekToDate: { attended: 3, missed: 1 },
    });
    expect(report?.idempotencyKey).toBe('daily:user-1:2026-10-12');
    expect(report?.subject).toBe('MyClassu: Monday, 12 October — 50% (1/2)');
    expect(report?.text).toContain(
      'Decided: 2 of 3 — 1 attended, 1 missed (50%).',
    );
    expect(report?.text).toContain('Still undecided: Lab.');
    expect(report?.text).toContain(
      'Networks (CSEN3141) — 2:00 PM – 2:50 PM · ICT / 606 — Health',
    );
    expect(report?.text).toContain('Week to date: 3 attended, 1 missed (75%).');
  });

  it('never counts undecided classes as missed', () => {
    const report = buildDailyReport({
      userId: 'user-1',
      dateKey: '2026-10-12',
      dateLabel: 'Monday',
      classes: [
        {
          subject: 'Lab',
          courseCode: 'X',
          timeLabel: '3:00 PM',
          status: 'undecided',
        },
      ],
      weekToDate: { attended: 0, missed: 0 },
    });
    expect(report?.text).toContain('none counted as missed');
    expect(report?.subject).toContain('no decisions yet');
  });

  it('produces a concise no-classes report', () => {
    const report = buildDailyReport({
      userId: 'user-1',
      dateKey: '2026-10-11',
      dateLabel: 'Sunday',
      classes: [],
      weekToDate: { attended: 0, missed: 0 },
    });
    expect(report?.idempotencyKey).toBe('daily:user-1:2026-10-11');
    expect(report?.text).toContain('No classes were scheduled today');
  });
});

describe('buildWeeklyReport', () => {
  it('summarizes the week with subjects, reasons, and comparison', () => {
    const report = buildWeeklyReport({
      userId: 'user-1',
      weekStartKey: '2026-10-05',
      weekLabel: 'Oct 5 – Oct 11',
      attended: 8,
      missed: 2,
      subjects: [
        { courseCode: 'MECH3271', attended: 4, missed: 0 },
        { courseCode: 'CSEN3141', attended: 4, missed: 2 },
      ],
      reasons: [{ label: 'Health', count: 2 }],
      previous: { attended: 5, missed: 5 },
    });
    expect(report.idempotencyKey).toBe('weekly:user-1:2026-10-05');
    expect(report.subject).toBe(
      'MyClassu: week of Oct 5 – Oct 11 — 80% (8/10)',
    );
    expect(report.text).toContain('- MECH3271: 4/4 (100%)');
    expect(report.text).toContain('- Health: 2');
    expect(report.text).toContain('Previous week: 50% — up by 30 points.');
  });

  it('distinguishes no records from 0% and skips thin comparisons', () => {
    const empty = buildWeeklyReport({
      userId: 'user-1',
      weekStartKey: '2026-10-05',
      weekLabel: 'Oct 5 – Oct 11',
      attended: 0,
      missed: 0,
      subjects: [],
      reasons: [],
      previous: null,
    });
    expect(empty.text).toContain('distinct from 0% attendance');
    expect(empty.subject).toContain('no decided classes');

    const thin = buildWeeklyReport({
      userId: 'user-1',
      weekStartKey: '2026-10-12',
      weekLabel: 'Oct 12 – Oct 18',
      attended: 0,
      missed: 3,
      subjects: [],
      reasons: [],
      previous: { attended: 0, missed: 0 },
    });
    expect(thin.text).toContain('not enough data to compare');
  });
});
