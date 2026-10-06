import type {
  AppSettings,
  ClassSession,
  Course,
  Weekday,
} from '../../../domain/models';

/**
 * Initial timetable, transcribed from the user's university screenshot.
 * This is structured local data — the app must work fully offline.
 *
 * NOTE: the same course legitimately meets in different rooms on different
 * days; that difference lives on the session entries below.
 */

export const APP_TIMEZONE = 'Asia/Kolkata';

export const courses: Course[] = [
  {
    id: 'course-mech3271',
    code: 'MECH3271',
    title: 'Total Quality Management',
    instructor: 'Battula Suryanarayana Murthy',
  },
  {
    id: 'course-24csen4121',
    code: '24CSEN4121',
    title: 'Building Agentic AI Systems',
    instructor: 'Hyma J',
  },
  {
    id: 'course-csen3141',
    code: 'CSEN3141',
    title: 'Advanced Computer Networks',
    instructor: 'Tadi Srinivas',
  },
  {
    id: 'course-viva3555',
    code: 'VIVA3555',
    title: 'Comprehensive Examination',
    instructor: 'Gondi Lakshmeeswari',
  },
  {
    id: 'course-mech2311',
    code: 'MECH2311',
    title: 'Fundamentals of Project Management',
    instructor: 'Sandeep Alanka',
  },
  {
    id: 'course-24csen4121p',
    code: '24CSEN4121P',
    title: 'Building Agentic AI Systems Lab',
    instructor: 'Hyma J',
  },
  {
    id: 'course-proj2999',
    code: 'PROJ2999',
    title: 'Project / Guide',
  },
];

export const sessions: ClassSession[] = [
  // Monday
  {
    id: 'session-mech3271-mon-1000',
    courseId: 'course-mech3271',
    weekday: 'monday',
    startTime: '10:00',
    endTime: '10:50',
    room: 'ICT / 331',
    instructor: 'Battula Suryanarayana Murthy',
  },
  {
    id: 'session-24csen4121-mon-1100',
    courseId: 'course-24csen4121',
    weekday: 'monday',
    startTime: '11:00',
    endTime: '11:50',
    room: 'ICT / 305',
    instructor: 'Hyma J',
  },
  {
    id: 'session-csen3141-mon-1400',
    courseId: 'course-csen3141',
    weekday: 'monday',
    startTime: '14:00',
    endTime: '14:50',
    room: 'ICT / 606',
    instructor: 'Tadi Srinivas',
  },
  {
    id: 'session-viva3555-mon-1500',
    courseId: 'course-viva3555',
    weekday: 'monday',
    startTime: '15:00',
    endTime: '15:50',
    room: 'ICT / 207',
    instructor: 'Gondi Lakshmeeswari',
  },

  // Tuesday
  {
    id: 'session-mech3271-tue-1000',
    courseId: 'course-mech3271',
    weekday: 'tuesday',
    startTime: '10:00',
    endTime: '10:50',
    room: 'ICT / 331',
    instructor: 'Battula Suryanarayana Murthy',
  },
  {
    id: 'session-csen3141-tue-1100',
    courseId: 'course-csen3141',
    weekday: 'tuesday',
    startTime: '11:00',
    endTime: '11:50',
    room: 'ICT / 607',
    instructor: 'Tadi Srinivas',
  },
  {
    id: 'session-24csen4121-tue-1400',
    courseId: 'course-24csen4121',
    weekday: 'tuesday',
    startTime: '14:00',
    endTime: '14:50',
    room: 'ICT / 118',
    instructor: 'Hyma J',
  },

  // Wednesday
  {
    id: 'session-mech3271-wed-1000',
    courseId: 'course-mech3271',
    weekday: 'wednesday',
    startTime: '10:00',
    endTime: '10:50',
    room: 'ICT / 331',
    instructor: 'Battula Suryanarayana Murthy',
  },
  {
    id: 'session-mech2311-wed-1100',
    courseId: 'course-mech2311',
    weekday: 'wednesday',
    startTime: '11:00',
    endTime: '11:50',
    room: 'ICT / 337',
    instructor: 'Sandeep Alanka',
  },
  {
    id: 'session-24csen4121p-wed-1400',
    courseId: 'course-24csen4121p',
    weekday: 'wednesday',
    startTime: '14:00',
    endTime: '15:50',
    room: 'ICT / 220',
    instructor: 'Hyma J',
  },

  // Thursday
  {
    id: 'session-proj2999-thu-0900',
    courseId: 'course-proj2999',
    weekday: 'thursday',
    startTime: '09:00',
    endTime: '09:50',
  },
  {
    id: 'session-mech2311-thu-1000',
    courseId: 'course-mech2311',
    weekday: 'thursday',
    startTime: '10:00',
    endTime: '10:50',
    room: 'ICT / 337',
    instructor: 'Sandeep Alanka',
  },
  {
    id: 'session-csen3141-thu-1100',
    courseId: 'course-csen3141',
    weekday: 'thursday',
    startTime: '11:00',
    endTime: '11:50',
    room: 'ICT / 331',
    instructor: 'Tadi Srinivas',
  },

  // Friday
  {
    id: 'session-mech2311-fri-1000',
    courseId: 'course-mech2311',
    weekday: 'friday',
    startTime: '10:00',
    endTime: '10:50',
    room: 'ICT / 337',
    instructor: 'Sandeep Alanka',
  },
];

export const timetable: Timetable = {
  timezone: APP_TIMEZONE,
  courses,
  sessions,
};

export interface Timetable {
  timezone: string;
  courses: Course[];
  sessions: ClassSession[];
}

/** Weekdays that actually have sessions scheduled (used for empty states). */
export const activeWeekdays: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

export const defaultSettings: AppSettings = {
  timezone: APP_TIMEZONE,
  reminderMinutes: 5,
  alarmEnabled: true,
  notificationEnabled: true,
  emailEnabled: false,
};
