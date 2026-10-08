import { buildHomeDashboard } from './dashboard';

/**
 * Home-dashboard behavior over the real bundled timetable, at deterministic
 * Asia/Kolkata instants. Week of the tests: 2026-10-05 (Monday) – 2026-10-11
 * (Sunday). IST is UTC+05:30 with no DST.
 */
const ist = (d: number, hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 9, d, hours - 5, minutes - 30));

describe('buildHomeDashboard — Monday', () => {
  it('before the first class: everything upcoming, next is today', () => {
    const dash = buildHomeDashboard(ist(5, 8, 0));
    expect(dash.heading).toBe('Ready for MECH3271?');
    expect(dash.classesToday).toBe(4);
    expect(dash.current).toBeNull();
    expect(dash.next?.courseCode).toBe('MECH3271');
    expect(dash.next?.isToday).toBe(true);
    expect(dash.next?.dayLabel).toBe('Today');
    expect(dash.next?.minutesUntil).toBe(120);
    expect(dash.timeline.map(entry => entry.status)).toEqual([
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('between classes: earlier classes completed, next today', () => {
    const dash = buildHomeDashboard(ist(5, 13, 0));
    expect(dash.current).toBeNull();
    expect(dash.next?.courseCode).toBe('CSEN3141');
    expect(dash.next?.minutesUntil).toBe(60);
    expect(dash.timeline.map(entry => entry.status)).toEqual([
      'completed',
      'completed',
      'upcoming',
      'upcoming',
    ]);
  });

  it('during a class: hero shows NOW with remaining time and progress', () => {
    const dash = buildHomeDashboard(ist(5, 14, 20));
    expect(dash.heading).toBe('In class now');
    expect(dash.current?.courseCode).toBe('CSEN3141');
    expect(dash.current?.courseTitle).toBe('Advanced Computer Networks');
    expect(dash.current?.room).toBe('ICT / 606');
    expect(dash.current?.minutesRemaining).toBe(30);
    expect(dash.current?.progress).toBeCloseTo(0.4, 5);
    expect(dash.next?.courseCode).toBe('VIVA3555');
    expect(dash.next?.minutesUntil).toBe(40);
  });

  it('at the exact start minute the class is current ([start, end))', () => {
    const dash = buildHomeDashboard(ist(5, 14, 0));
    expect(dash.current?.courseCode).toBe('CSEN3141');
    expect(dash.current?.progress).toBeCloseTo(0, 5);
  });

  it('at the exact end minute the class is no longer current', () => {
    const dash = buildHomeDashboard(ist(5, 14, 50));
    expect(dash.current).toBeNull();
    expect(dash.next?.courseCode).toBe('VIVA3555');
  });

  it('after the last class: day done, next is tomorrow', () => {
    const dash = buildHomeDashboard(ist(5, 16, 0));
    expect(dash.heading).toBe('Done for today');
    expect(dash.summary).toContain('All 4 done');
    expect(dash.next?.courseCode).toBe('MECH3271');
    expect(dash.next?.dayLabel).toBe('Tomorrow');
    expect(dash.next?.dateKey).toBe('2026-10-06');
    expect(dash.timeline.every(entry => entry.status === 'completed')).toBe(
      true,
    );
  });

  it('orders the today timeline chronologically with per-session rooms', () => {
    const dash = buildHomeDashboard(ist(5, 12, 0));
    expect(dash.timeline.map(entry => entry.courseCode)).toEqual([
      'MECH3271',
      '24CSEN4121',
      'CSEN3141',
      'VIVA3555',
    ]);
    expect(dash.timeline[1]?.room).toBe('ICT / 305');
  });
});

describe('buildHomeDashboard — other weekdays', () => {
  it('Tuesday: the hero uses the session-specific room (ICT / 118)', () => {
    const dash = buildHomeDashboard(ist(6, 14, 20));
    expect(dash.current?.courseCode).toBe('24CSEN4121');
    expect(dash.current?.room).toBe('ICT / 118');
    expect(dash.current?.minutesRemaining).toBe(30);
  });

  it('Wednesday lab: still current late in the two-hour block', () => {
    const dash = buildHomeDashboard(ist(7, 15, 0));
    expect(dash.current?.courseCode).toBe('24CSEN4121P');
    expect(dash.current?.progress).toBeCloseTo(60 / 110, 5);
    expect(dash.current?.minutesRemaining).toBe(50);
  });

  it('Wednesday after the lab: next is Thursday 09:00 tomorrow', () => {
    const dash = buildHomeDashboard(ist(7, 15, 50));
    expect(dash.current).toBeNull();
    expect(dash.next?.courseCode).toBe('PROJ2999');
    expect(dash.next?.dayLabel).toBe('Tomorrow');
    expect(dash.next?.startTimeLabel).toBe('9:00 AM');
  });

  it('Thursday before 09:00: Project/Guide session has no room', () => {
    const dash = buildHomeDashboard(ist(8, 8, 30));
    expect(dash.next?.courseCode).toBe('PROJ2999');
    expect(dash.next?.room).toBeUndefined();
    expect(dash.next?.instructor).toBeUndefined();
    expect(dash.classesToday).toBe(3);
  });

  it('Friday after 10:50: next class is Monday 10:00', () => {
    const dash = buildHomeDashboard(ist(9, 16, 0));
    expect(dash.heading).toBe('Done for today');
    expect(dash.next?.courseCode).toBe('MECH3271');
    expect(dash.next?.dayLabel).toBe('Monday');
    expect(dash.next?.dateKey).toBe('2026-10-12');
    expect(dash.upcomingPreview.map(entry => entry.dateKey)).toEqual([
      '2026-10-12',
      '2026-10-12',
      '2026-10-12',
    ]);
  });
});

describe('buildHomeDashboard — weekend', () => {
  it('Saturday: free day, next class Monday, preview spans next week', () => {
    const dash = buildHomeDashboard(ist(10, 12, 0));
    expect(dash.heading).toBe('A free day');
    expect(dash.classesToday).toBe(0);
    expect(dash.timeline).toEqual([]);
    expect(dash.current).toBeNull();
    expect(dash.next?.dayLabel).toBe('Monday');
    expect(dash.next?.startTimeLabel).toBe('10:00 AM');
    expect(dash.upcomingPreview).toHaveLength(3);
    expect(
      dash.upcomingPreview.every(entry => entry.dayLabel === 'Monday'),
    ).toBe(true);
  });

  it('Sunday: still points at Monday', () => {
    const dash = buildHomeDashboard(ist(11, 12, 0));
    expect(dash.next?.dayLabel).toBe('Tomorrow');
    expect(dash.next?.dateKey).toBe('2026-10-12');
  });
});

describe('buildHomeDashboard — presentation data', () => {
  it('formats the date label in Asia/Kolkata', () => {
    const dash = buildHomeDashboard(ist(5, 9, 0));
    expect(dash.dateLabel).toBe('Monday, 5 October');
    expect(dash.weekday).toBe('monday');
    expect(dash.dateKey).toBe('2026-10-05');
  });

  it('labels times as 12-hour clock', () => {
    const dash = buildHomeDashboard(ist(5, 8, 0));
    expect(dash.next?.startTimeLabel).toBe('10:00 AM');
    const afternoon = buildHomeDashboard(ist(5, 13, 0));
    expect(afternoon.next?.startTimeLabel).toBe('2:00 PM');
  });

  it('excludes today from the coming-up preview', () => {
    const dash = buildHomeDashboard(ist(5, 13, 0));
    expect(
      dash.upcomingPreview.every(entry => entry.dateKey !== dash.dateKey),
    ).toBe(true);
    // Tuesday has three sessions, all tomorrow from Monday 13:00.
    expect(dash.upcomingPreview.map(entry => entry.dayLabel)).toEqual([
      'Tomorrow',
      'Tomorrow',
      'Tomorrow',
    ]);
    expect(
      dash.upcomingPreview.every(entry => entry.dateKey === '2026-10-06'),
    ).toBe(true);
  });

  it('keeps the countdown honest across a class boundary', () => {
    const before = buildHomeDashboard(ist(5, 13, 59));
    expect(before.current).toBeNull();
    expect(before.next?.minutesUntil).toBe(1);
    const atStart = buildHomeDashboard(ist(5, 14, 0));
    expect(atStart.current?.courseCode).toBe('CSEN3141');
    expect(atStart.next?.minutesUntil).toBe(60); // next AFTER the current one
  });
});
