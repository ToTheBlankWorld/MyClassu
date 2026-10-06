import { courses, sessions, timetable, activeWeekdays } from './timetable';
import { courseById, sessionsForWeekday } from '../queries';
import { parseHHmm } from '../../../utils/time';

describe('initial timetable data', () => {
  it('uses the university timezone', () => {
    expect(timetable.timezone).toBe('Asia/Kolkata');
  });

  it('has exactly 14 sessions', () => {
    expect(sessions).toHaveLength(14);
  });

  it('references only existing courses', () => {
    for (const session of sessions) {
      expect(courseById(timetable, session.courseId)).toBeDefined();
    }
  });

  it('has valid, ordered times on every session', () => {
    for (const session of sessions) {
      const start = parseHHmm(session.startTime);
      const end = parseHHmm(session.endTime);
      expect(start).not.toBeNull();
      expect(end).not.toBeNull();
      expect(end! - start!).toBeGreaterThan(0);
    }
  });

  it('keeps session ids unique', () => {
    const ids = new Set(sessions.map(session => session.id));
    expect(ids.size).toBe(sessions.length);
  });

  it('schedules Monday correctly (4 sessions, chronological)', () => {
    const monday = sessionsForWeekday(timetable, 'monday');
    expect(monday.map(session => session.courseId)).toEqual([
      'course-mech3271',
      'course-24csen4121',
      'course-csen3141',
      'course-viva3555',
    ]);
  });

  it('keeps per-session rooms for the same course (24CSEN4121)', () => {
    // Monday: ICT / 305; Tuesday: ICT / 118 — distinct schedule entries.
    const monday = sessionsForWeekday(timetable, 'monday').find(
      session => session.courseId === 'course-24csen4121',
    );
    const tuesday = sessionsForWeekday(timetable, 'tuesday').find(
      session => session.courseId === 'course-24csen4121',
    );
    expect(monday?.room).toBe('ICT / 305');
    expect(tuesday?.room).toBe('ICT / 118');
  });

  it('models the Wednesday lab as a two-hour session', () => {
    const lab = sessionsForWeekday(timetable, 'wednesday').find(
      session => session.courseId === 'course-24csen4121p',
    );
    expect(lab?.startTime).toBe('14:00');
    expect(lab?.endTime).toBe('15:50');
    expect(lab?.room).toBe('ICT / 220');
  });

  it('leaves the Project/Guide session without room or instructor', () => {
    const project = sessions.find(
      session => session.courseId === 'course-proj2999',
    );
    expect(project).toBeDefined();
    expect(project?.room).toBeUndefined();
    expect(project?.instructor).toBeUndefined();
  });

  it('has only one session on Friday', () => {
    const friday = sessionsForWeekday(timetable, 'friday');
    expect(friday).toHaveLength(1);
    expect(friday[0]?.courseId).toBe('course-mech2311');
  });

  it('declares exactly the weekdays that carry sessions', () => {
    const withSessions = new Set(sessions.map(session => session.weekday));
    expect(activeWeekdays.sort()).toEqual([...withSessions].sort());
  });

  it('gives every course a code and title', () => {
    for (const course of courses) {
      expect(course.code.length).toBeGreaterThan(0);
      expect(course.title.length).toBeGreaterThan(0);
    }
  });
});
