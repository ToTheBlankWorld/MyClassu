import {
  breakdownReasons,
  buildHistory,
  buildWeeklyTrend,
  groupBySubject,
  summarizeAttendance,
} from './analytics';
import type { LocalAttendanceRecord } from './attendance';

/** Representative decided records across subjects, days, and reasons. */
function record(
  id: string,
  dateKey: string,
  courseCode: string,
  status: 'attended' | 'skipped',
  extra: Partial<LocalAttendanceRecord> = {},
): LocalAttendanceRecord {
  return {
    id,
    sessionId: `session-${courseCode.toLowerCase()}`,
    dateKey,
    courseCode,
    subject: `Subject ${courseCode}`,
    classStartMillis: 1000,
    classEndMillis: 2000,
    status,
    markedAtMillis: 3000,
    updatedAtMillis: 4000,
    synced: false,
    ...extra,
  };
}

const FIXTURES: LocalAttendanceRecord[] = [
  record('a|2026-10-05', '2026-10-05', 'MECH3271', 'attended'),
  record('b|2026-10-05', '2026-10-05', 'CSEN3141', 'attended'),
  record('c|2026-10-06', '2026-10-06', 'MECH3271', 'skipped', {
    reasonCategory: 'health',
  }),
  record('d|2026-10-07', '2026-10-07', 'CSEN3141', 'skipped', {
    reasonCategory: 'other',
    reasonText: 'Bus broke down',
  }),
  record('e|2026-10-12', '2026-10-12', 'MECH3271', 'attended'),
  record('f|2026-10-12', '2026-10-12', 'CSEN3141', 'attended'),
];

describe('summarizeAttendance', () => {
  it('computes counts and percentage over decided classes only', () => {
    expect(summarizeAttendance(FIXTURES)).toEqual({
      attended: 4,
      missed: 2,
      decided: 6,
      percentage: 67,
    });
  });

  it('returns null percentage with no decided records', () => {
    expect(summarizeAttendance([])).toEqual({
      attended: 0,
      missed: 0,
      decided: 0,
      percentage: null,
    });
  });

  it('ignores malformed and undecided records', () => {
    const records = [
      ...FIXTURES,
      { ...FIXTURES[0], id: '', status: 'attended' },
      { ...FIXTURES[0], id: 'x', dateKey: 'not-a-date', status: 'attended' },
      { ...FIXTURES[0], id: 'y', status: 'pending' },
    ] as LocalAttendanceRecord[];
    expect(summarizeAttendance(records)).toEqual({
      attended: 4,
      missed: 2,
      decided: 6,
      percentage: 67,
    });
  });

  it('collapses duplicate IDs to the newest write', () => {
    const records = [
      record('a|2026-10-05', '2026-10-05', 'MECH3271', 'attended'),
      {
        ...record('a|2026-10-05', '2026-10-05', 'MECH3271', 'skipped', {
          reasonCategory: 'health',
        }),
        markedAtMillis: 9999,
      },
    ];
    expect(summarizeAttendance(records)).toEqual({
      attended: 0,
      missed: 1,
      decided: 1,
      percentage: 0,
    });
  });
});

describe('groupBySubject', () => {
  it('groups by course code with weakest first', () => {
    const groups = groupBySubject(FIXTURES);
    // Tied percentages keep first-seen order (stable sort).
    expect(groups.map(group => group.courseCode)).toEqual([
      'MECH3271',
      'CSEN3141',
    ]);
    expect(groups[0]).toMatchObject({
      attended: 2,
      missed: 1,
      decided: 3,
      percentage: 67,
    });
    expect(groups[1]).toMatchObject({
      attended: 2,
      missed: 1,
      decided: 3,
      percentage: 67,
    });
  });

  it('separates a perfect subject from a weak one', () => {
    const groups = groupBySubject([
      record('a', '2026-10-05', 'GOOD1000', 'attended'),
      record('b', '2026-10-05', 'BAD2000', 'skipped', {
        reasonCategory: 'health',
      }),
      record('c', '2026-10-06', 'BAD2000', 'skipped', {
        reasonCategory: 'work',
      }),
    ]);
    expect(groups[0].courseCode).toBe('BAD2000');
    expect(groups[0].percentage).toBe(0);
    expect(groups[1].courseCode).toBe('GOOD1000');
    expect(groups[1].percentage).toBe(100);
  });

  it('never merges look-alike names across codes', () => {
    const groups = groupBySubject([
      {
        ...record('a', '2026-10-05', 'CS101', 'attended'),
        subject: 'Networks',
      },
      {
        ...record('b', '2026-10-05', 'CS102', 'attended'),
        subject: 'Networks',
      },
    ]);
    expect(groups).toHaveLength(2);
  });

  it('returns null percentage for an empty input', () => {
    expect(groupBySubject([])).toEqual([]);
  });
});

describe('buildHistory', () => {
  it('sorts newest first and carries reason context', () => {
    const history = buildHistory(FIXTURES, 'all');
    expect(history.map(entry => entry.dateKey)).toEqual([
      '2026-10-12',
      '2026-10-12',
      '2026-10-07',
      '2026-10-06',
      '2026-10-05',
      '2026-10-05',
    ]);
    const missed = history.find(entry => entry.id === 'd|2026-10-07');
    expect(missed).toMatchObject({
      status: 'missed',
      reasonLabel: 'Other',
      customReason: 'Bus broke down',
    });
    const plainMiss = history.find(entry => entry.id === 'c|2026-10-06');
    expect(plainMiss?.reasonLabel).toBe('Health');
    expect(plainMiss?.customReason).toBeNull();
    const hit = history.find(entry => entry.id === 'a|2026-10-05');
    expect(hit?.reasonLabel).toBeNull();
  });

  it('filters by decision', () => {
    expect(buildHistory(FIXTURES, 'attended')).toHaveLength(4);
    expect(
      buildHistory(FIXTURES, 'attended').every(
        entry => entry.status === 'attended',
      ),
    ).toBe(true);
    expect(buildHistory(FIXTURES, 'missed')).toHaveLength(2);
  });

  it('labels a missing reason neutrally', () => {
    const history = buildHistory([
      record('x', '2026-10-05', 'MECH3271', 'skipped'),
    ]);
    expect(history[0].reasonLabel).toBe('No reason given');
  });
});

describe('breakdownReasons', () => {
  it('counts reasons with shares of missed classes', () => {
    expect(breakdownReasons(FIXTURES)).toEqual([
      { value: 'health', label: 'Health', count: 1, percentOfMissed: 50 },
      { value: 'other', label: 'Other', count: 1, percentOfMissed: 50 },
    ]);
  });

  it('returns empty with no missed classes', () => {
    expect(breakdownReasons([])).toEqual([]);
    expect(
      breakdownReasons([record('a', '2026-10-05', 'MECH3271', 'attended')]),
    ).toEqual([]);
  });
});

describe('buildWeeklyTrend', () => {
  const scheduled = () => 0;

  it('groups Monday-first weeks ending with the current week', () => {
    const trend = buildWeeklyTrend(FIXTURES, '2026-10-14', 2, scheduled);
    expect(trend.map(week => week.weekStartKey)).toEqual([
      '2026-10-05',
      '2026-10-12',
    ]);
    expect(trend[0]).toMatchObject({
      attended: 2,
      missed: 2,
      decided: 4,
      percentage: 50,
    });
    expect(trend[1]).toMatchObject({
      attended: 2,
      missed: 0,
      decided: 2,
      percentage: 100,
    });
  });

  it('marks empty weeks as no-data instead of zero percent', () => {
    const trend = buildWeeklyTrend(FIXTURES, '2026-10-28', 2, scheduled);
    expect(trend.map(week => week.percentage)).toEqual([null, null]);
    expect(trend.every(week => week.decided === 0)).toBe(true);
  });

  it('spans month and year boundaries', () => {
    const trend = buildWeeklyTrend(
      [record('a', '2025-12-31', 'MECH3271', 'attended')],
      '2026-01-02',
      2,
      scheduled,
    );
    expect(trend.map(week => week.weekStartKey)).toEqual([
      '2025-12-22',
      '2025-12-29',
    ]);
    expect(trend[1].decided).toBe(1);
    expect(trend[1].label).toBe('Dec 29');
  });

  it('includes engine scheduled counts for eligible context', () => {
    const trend = buildWeeklyTrend(FIXTURES, '2026-10-14', 1, () => 3);
    expect(trend[0].scheduled).toBe(21);
    expect(trend[0].decided).toBe(2);
  });

  it('rejects invalid inputs', () => {
    expect(() => buildWeeklyTrend(FIXTURES, 'nope', 2, scheduled)).toThrow();
    expect(() =>
      buildWeeklyTrend(FIXTURES, '2026-10-14', 0, scheduled),
    ).toThrow();
  });
});
