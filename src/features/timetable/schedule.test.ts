import { buildScheduleView } from './schedule';

/**
 * Schedule-selector behavior over the real bundled timetable at
 * deterministic Asia/Kolkata instants. Reference week: 2026-10-05
 * (Monday) – 2026-10-11 (Sunday). IST is UTC+05:30 with no DST.
 */
const ist = (d: number, hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 9, d, hours - 5, minutes - 30));

describe('buildScheduleView — week strip', () => {
  it('defaults the selection to today with a full Mon–Sun strip', () => {
    const view = buildScheduleView(ist(5, 8, 0), null);
    expect(view.selectedKey).toBe('2026-10-05');
    expect(view.todayKey).toBe('2026-10-05');
    expect(view.weekStartKey).toBe('2026-10-05');
    expect(view.weekDays.map(day => day.dateKey)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(view.weekDays.map(day => day.weekdayShort)).toEqual([
      'MON',
      'TUE',
      'WED',
      'THU',
      'FRI',
      'SAT',
      'SUN',
    ]);
    expect(view.weekDays.map(day => day.dayNumber)).toEqual([
      5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it('counts classes per day from the engine (weekend is empty)', () => {
    const view = buildScheduleView(ist(5, 8, 0), null);
    expect(view.weekDays.map(day => day.classCount)).toEqual([
      4, 3, 3, 3, 1, 0, 0,
    ]);
  });

  it('marks today and the selection', () => {
    const view = buildScheduleView(ist(7, 12, 0), '2026-10-09');
    expect(
      view.weekDays.find(day => day.dateKey === '2026-10-07')?.isToday,
    ).toBe(true);
    expect(
      view.weekDays.find(day => day.dateKey === '2026-10-09')?.isSelected,
    ).toBe(true);
    expect(view.weekDays.filter(day => day.isSelected)).toHaveLength(1);
    expect(view.showTodayButton).toBe(true);
  });

  it('hides the Today button when the selection is today', () => {
    const view = buildScheduleView(ist(5, 8, 0), '2026-10-05');
    expect(view.showTodayButton).toBe(false);
  });

  it('labels the week range from its Monday', () => {
    expect(buildScheduleView(ist(5, 8, 0), null).weekLabel).toBe(
      'Oct 5 – Oct 11',
    );
    expect(buildScheduleView(ist(7, 12, 0), '2026-10-09').weekLabel).toBe(
      'Oct 5 – Oct 11',
    );
  });

  it('derives the week from a Sunday selection (week still starts Monday)', () => {
    const view = buildScheduleView(ist(11, 12, 0), '2026-10-11');
    expect(view.weekStartKey).toBe('2026-10-05');
    expect(view.weekLabel).toBe('Oct 5 – Oct 11');
  });

  it('announces each day for TalkBack', () => {
    const view = buildScheduleView(ist(5, 8, 0), null);
    expect(view.weekDays[0].accessibilityLabel).toBe(
      'Monday, Oct 5, selected, today, 4 classes',
    );
    expect(view.weekDays[5].accessibilityLabel).toBe(
      'Saturday, Oct 10, 0 classes',
    );
  });
});

describe('buildScheduleView — day headings', () => {
  it('names Today / Tomorrow / Yesterday relative to now', () => {
    expect(buildScheduleView(ist(5, 8, 0), '2026-10-05').dayHeading).toBe(
      'Today',
    );
    expect(buildScheduleView(ist(5, 8, 0), '2026-10-06').dayHeading).toBe(
      'Tomorrow',
    );
    expect(buildScheduleView(ist(6, 8, 0), '2026-10-05').dayHeading).toBe(
      'Yesterday',
    );
    expect(buildScheduleView(ist(5, 8, 0), '2026-10-09').dayHeading).toBe(
      'Friday',
    );
  });

  it('summarizes the day span from the first to the last class', () => {
    expect(buildScheduleView(ist(5, 8, 0), '2026-10-05').daySummary).toBe(
      '4 classes · 10:00 AM – 3:50 PM',
    );
    expect(buildScheduleView(ist(9, 8, 0), '2026-10-09').daySummary).toBe(
      '1 class · 10:00 AM – 10:50 AM',
    );
    expect(buildScheduleView(ist(10, 8, 0), '2026-10-10').daySummary).toBe(
      'No classes',
    );
  });
});

describe('buildScheduleView — today timeline states', () => {
  it('marks everything upcoming before the first class', () => {
    const view = buildScheduleView(ist(5, 8, 0), '2026-10-05');
    expect(view.timeline.map(entry => entry.status)).toEqual([
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(view.timeline.every(entry => entry.progress === null)).toBe(true);
  });

  it('marks the running class current with progress', () => {
    const view = buildScheduleView(ist(5, 14, 20), '2026-10-05');
    expect(view.timeline.map(entry => entry.status)).toEqual([
      'completed',
      'completed',
      'current',
      'upcoming',
    ]);
    expect(view.timeline[2].progress).toBeCloseTo(0.4, 5);
    expect(view.timeline[2].courseCode).toBe('CSEN3141');
  });

  it('marks everything completed after the last class', () => {
    const view = buildScheduleView(ist(5, 16, 0), '2026-10-05');
    expect(view.timeline.every(entry => entry.status === 'completed')).toBe(
      true,
    );
  });

  it('orders chronologically with session-specific rooms', () => {
    const view = buildScheduleView(ist(5, 12, 0), '2026-10-05');
    expect(view.timeline.map(entry => entry.courseCode)).toEqual([
      'MECH3271',
      '24CSEN4121',
      'CSEN3141',
      'VIVA3555',
    ]);
    // Same course, different rooms on different days — never normalized.
    expect(view.timeline[1].room).toBe('ICT / 305');
    const tuesday = buildScheduleView(ist(6, 12, 0), '2026-10-06');
    expect(
      tuesday.timeline.find(entry => entry.courseCode === '24CSEN4121')?.room,
    ).toBe('ICT / 118');
  });
});

describe('buildScheduleView — past and future days', () => {
  it('marks every class completed on a past day', () => {
    const view = buildScheduleView(ist(7, 12, 0), '2026-10-05');
    expect(view.timeline).toHaveLength(4);
    expect(view.timeline.every(entry => entry.status === 'completed')).toBe(
      true,
    );
    expect(view.timeline.every(entry => entry.progress === null)).toBe(true);
  });

  it('marks every class upcoming on a future day', () => {
    const view = buildScheduleView(ist(5, 16, 0), '2026-10-07');
    expect(view.timeline.map(entry => entry.status)).toEqual([
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('shows an empty Saturday pointing at Monday', () => {
    const view = buildScheduleView(ist(10, 12, 0), '2026-10-10');
    expect(view.timeline).toEqual([]);
    expect(view.dayHeading).toBe('Today');
    expect(view.next?.dayLabel).toBe('Monday');
    expect(view.next?.startTimeLabel).toBe('10:00 AM');
  });

  it('shows an empty Sunday pointing at tomorrow (Monday)', () => {
    const view = buildScheduleView(ist(11, 12, 0), '2026-10-11');
    expect(view.timeline).toEqual([]);
    expect(view.dayHeading).toBe('Today');
    expect(view.next?.dayLabel).toBe('Tomorrow');
  });
});

describe('buildScheduleView — special sessions', () => {
  it('keeps the Wednesday lab as one 110-minute entry', () => {
    const view = buildScheduleView(ist(7, 15, 0), '2026-10-07');
    const lab = view.timeline.find(entry => entry.courseCode === '24CSEN4121P');
    expect(lab?.startTimeLabel).toBe('2:00 PM');
    expect(lab?.endTimeLabel).toBe('3:50 PM');
    expect(lab?.durationLabel).toBe('1 h 50 min');
    expect(lab?.status).toBe('current');
    expect(lab?.progress).toBeCloseTo(60 / 110, 5);
    expect(view.timeline).toHaveLength(3);
  });

  it('labels normal lectures with a 50-minute duration', () => {
    const view = buildScheduleView(ist(5, 8, 0), '2026-10-05');
    expect(view.timeline[0].durationLabel).toBe('50 min');
  });

  it('handles the room-less Project/Guide session', () => {
    const view = buildScheduleView(ist(8, 8, 30), '2026-10-08');
    const project = view.timeline[0];
    expect(project.courseCode).toBe('PROJ2999');
    expect(project.room).toBeUndefined();
    expect(project.instructor).toBeUndefined();
    expect(view.timeline).toHaveLength(3);
  });

  it('handles the comprehensive examination session', () => {
    const view = buildScheduleView(ist(5, 15, 20), '2026-10-05');
    const exam = view.timeline.find(entry => entry.courseCode === 'VIVA3555');
    expect(exam?.room).toBe('ICT / 207');
    expect(exam?.instructor).toBe('Gondi Lakshmeeswari');
    expect(exam?.status).toBe('current');
  });
});

describe('buildScheduleView — week and date boundaries', () => {
  it('spans a month boundary (Nov 2 – Nov 8)', () => {
    const view = buildScheduleView(
      new Date(Date.UTC(2026, 10, 2, 4, 0)),
      '2026-11-04',
    );
    expect(view.weekStartKey).toBe('2026-11-02');
    expect(view.weekLabel).toBe('Nov 2 – Nov 8');
    expect(view.weekDays.map(day => day.dayNumber)).toEqual([
      2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('spans a year boundary (Dec 29 – Jan 4)', () => {
    const view = buildScheduleView(
      new Date(Date.UTC(2025, 11, 31, 4, 0)),
      '2025-12-31',
    );
    expect(view.weekStartKey).toBe('2025-12-29');
    expect(view.weekLabel).toBe('Dec 29 – Jan 4');
    expect(view.weekDays.map(day => day.dateKey)).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ]);
  });

  it('rejects a malformed selected key instead of rendering garbage', () => {
    expect(() => buildScheduleView(ist(5, 8, 0), 'not-a-date')).toThrow();
  });

  it('keeps Friday-after-class pointing at Monday across the weekend', () => {
    const view = buildScheduleView(ist(9, 16, 0), '2026-10-09');
    expect(view.timeline.every(entry => entry.status === 'completed')).toBe(
      true,
    );
    expect(view.next?.dayLabel).toBe('Monday');
  });
});
