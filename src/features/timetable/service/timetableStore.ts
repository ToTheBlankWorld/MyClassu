import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { ClassSession, Course, Weekday } from '../../../domain/models';
import { WEEKDAYS } from '../../../domain/models';
import type { Timetable } from '../data/timetable';
import { timetable as bundledTimetable } from '../data/timetable';
import {
  createTimetableService,
  type TimetableService,
} from './timetableService';
import { parseHHmm } from '../../../utils/time';

/**
 * Authoritative editable timetable store. The bundled timetable is the
 * seed; any user edit is persisted locally (versioned JSON) and becomes
 * the active timetable for every screen. The static bundled array is
 * never mutated at runtime.
 *
 * Identity: bundled session/course IDs are preserved forever (attendance
 * records refer to them). New sessions/courses get generated IDs once at
 * creation. Deleting a session removes future alarms; historical
 * attendance records live in a separate store and are never touched.
 */

export const TIMETABLE_STORAGE_KEY = 'myclassu.timetable.v1';
const STORE_VERSION = 1;

interface StoredTimetable {
  version: number;
  timezone: string;
  courses: Course[];
  sessions: ClassSession[];
}

export interface SessionInput {
  courseId: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
}

export interface CourseInput {
  code: string;
  title: string;
  instructor?: string;
}

/** Human-readable validation problems (empty = valid). */
export function validateSessionInput(
  timetable: Timetable,
  input: SessionInput,
): string[] {
  const problems: string[] = [];
  if (!timetable.courses.some(course => course.id === input.courseId)) {
    problems.push('Choose a valid course.');
  }
  if (!WEEKDAYS.includes(input.weekday)) {
    problems.push('Choose a valid weekday.');
  }
  const start = parseHHmm(input.startTime);
  const end = parseHHmm(input.endTime);
  if (start === null) {
    problems.push('Start time must look like 14:00.');
  }
  if (end === null) {
    problems.push('End time must look like 14:00.');
  }
  if (start !== null && end !== null && end <= start) {
    problems.push('End time must be after start time.');
  }
  return problems;
}

export function validateCourseInput(input: CourseInput): string[] {
  const problems: string[] = [];
  if (input.code.trim() === '') {
    problems.push('Course code is required.');
  }
  if (input.title.trim() === '') {
    problems.push('Subject name is required.');
  }
  return problems;
}

export interface OverlapInfo {
  sessionId: string;
  courseCode: string;
  startTime: string;
  endTime: string;
}

/**
 * Sessions on the same weekday whose [start, end) intervals intersect the
 * given range (optionally ignoring one session, for edits). Same course
 * code never merges anything — identity is always the session ID.
 */
export function findOverlaps(
  timetable: Timetable,
  weekday: Weekday,
  startTime: string,
  endTime: string,
  ignoreSessionId?: string,
): OverlapInfo[] {
  const start = parseHHmm(startTime);
  const end = parseHHmm(endTime);
  if (start === null || end === null || end <= start) {
    return [];
  }
  const result: OverlapInfo[] = [];
  for (const session of timetable.sessions) {
    if (session.weekday !== weekday || session.id === ignoreSessionId) {
      continue;
    }
    const otherStart = parseHHmm(session.startTime);
    const otherEnd = parseHHmm(session.endTime);
    if (otherStart === null || otherEnd === null) {
      continue;
    }
    if (start < otherEnd && otherStart < end) {
      const course = timetable.courses.find(c => c.id === session.courseId);
      result.push({
        sessionId: session.id,
        courseCode: course?.code ?? session.courseId,
        startTime: session.startTime,
        endTime: session.endTime,
      });
    }
  }
  return result;
}

function generateId(prefix: string): string {
  const random = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(4, '0');
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Pure CRUD over an immutable timetable value (no I/O here). */
export function addCourse(
  timetable: Timetable,
  input: CourseInput,
): { timetable: Timetable; course: Course } {
  const problems = validateCourseInput(input);
  if (problems.length > 0) {
    throw new Error(problems.join(' '));
  }
  const course: Course = {
    id: generateId('course-custom'),
    code: input.code.trim(),
    title: input.title.trim(),
    ...(input.instructor?.trim()
      ? { instructor: input.instructor.trim() }
      : {}),
  };
  return {
    timetable: { ...timetable, courses: [...timetable.courses, course] },
    course,
  };
}

export function addSession(
  timetable: Timetable,
  input: SessionInput,
): { timetable: Timetable; session: ClassSession } {
  const problems = validateSessionInput(timetable, input);
  if (problems.length > 0) {
    throw new Error(problems.join(' '));
  }
  const session: ClassSession = {
    id: generateId('session-custom'),
    courseId: input.courseId,
    weekday: input.weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    ...(input.room?.trim() ? { room: input.room.trim() } : {}),
    ...(input.instructor?.trim()
      ? { instructor: input.instructor.trim() }
      : {}),
  };
  return {
    timetable: { ...timetable, sessions: [...timetable.sessions, session] },
    session,
  };
}

export function updateSession(
  timetable: Timetable,
  sessionId: string,
  input: SessionInput,
): Timetable {
  const problems = validateSessionInput(timetable, input);
  if (problems.length > 0) {
    throw new Error(problems.join(' '));
  }
  let found = false;
  const sessions = timetable.sessions.map(session => {
    if (session.id !== sessionId) {
      return session;
    }
    found = true;
    return {
      ...session,
      courseId: input.courseId,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      room: cleanOptional(input.room),
      instructor: cleanOptional(input.instructor),
    };
  });
  if (!found) {
    throw new Error('Session not found.');
  }
  return { ...timetable, sessions };
}

/** Remove a session by stable ID. Courses and attendance are untouched. */
export function deleteSession(
  timetable: Timetable,
  sessionId: string,
): Timetable {
  if (!timetable.sessions.some(session => session.id === sessionId)) {
    throw new Error('Session not found.');
  }
  return {
    ...timetable,
    sessions: timetable.sessions.filter(session => session.id !== sessionId),
  };
}

// ---------------------------------------------------------- persistence

function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'string' && WEEKDAYS.includes(value as Weekday);
}

function isValidTimetableShape(value: unknown): value is StoredTimetable {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== STORE_VERSION) {
    return false;
  }
  if (
    typeof candidate.timezone !== 'string' ||
    !Array.isArray(candidate.courses)
  ) {
    return false;
  }
  if (!Array.isArray(candidate.sessions)) {
    return false;
  }
  return candidate.sessions.every(
    session =>
      typeof session === 'object' &&
      session !== null &&
      typeof (session as ClassSession).id === 'string' &&
      typeof (session as ClassSession).courseId === 'string' &&
      isWeekday((session as ClassSession).weekday) &&
      typeof (session as ClassSession).startTime === 'string' &&
      typeof (session as ClassSession).endTime === 'string',
  );
}

/**
 * Parse stored JSON into a timetable. Unknown versions, malformed JSON,
 * or invalid shapes return null so callers fall back to bundled data.
 * Old stored versions migrate here when the schema evolves.
 */
export function parseStoredTimetable(raw: string | null): Timetable | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidTimetableShape(parsed)) {
      return null;
    }
    return {
      timezone: parsed.timezone,
      courses: parsed.courses,
      sessions: parsed.sessions,
    };
  } catch {
    return null;
  }
}

export function serializeTimetable(timetable: Timetable): string {
  const stored: StoredTimetable = {
    version: STORE_VERSION,
    timezone: timetable.timezone,
    courses: timetable.courses,
    sessions: timetable.sessions,
  };
  return JSON.stringify(stored);
}

export async function loadStoredTimetable(): Promise<Timetable | null> {
  try {
    return parseStoredTimetable(
      await AsyncStorage.getItem(TIMETABLE_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export async function saveTimetable(timetable: Timetable): Promise<void> {
  await AsyncStorage.setItem(
    TIMETABLE_STORAGE_KEY,
    serializeTimetable(timetable),
  );
}

export async function resetTimetable(): Promise<void> {
  await AsyncStorage.removeItem(TIMETABLE_STORAGE_KEY);
}

// ---------------------------------------------------------- active state

let activeTimetable: Timetable = bundledTimetable;
let activeService: TimetableService = createTimetableService(bundledTimetable);
const listeners = new Set<() => void>();

function publish(next: Timetable): void {
  activeTimetable = next;
  activeService = createTimetableService(next);
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A failing subscriber must never break the store.
    }
  }
}

/** The timetable every screen must read (bundled until edits load). */
export function getActiveTimetable(): Timetable {
  return activeTimetable;
}

/** Service bound to the active timetable (rebuilt on every change). */
export function getActiveTimetableService(): TimetableService {
  return activeService;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Persist + publish. All screens and the alarm resync follow. */
export async function commitTimetable(next: Timetable): Promise<void> {
  await saveTimetable(next);
  publish(next);
}

/** Drop custom edits and return to the bundled timetable. */
export async function restoreBundledTimetable(): Promise<void> {
  await resetTimetable();
  publish(bundledTimetable);
}

export interface ActiveTimetable {
  timetable: Timetable;
  service: TimetableService;
  ready: boolean;
  refresh: () => void;
}

/** Hydrate from storage once; re-render subscribers on every commit. */
export function useActiveTimetable(): ActiveTimetable {
  const [timetable, setTimetable] = useState<Timetable>(() =>
    getActiveTimetable(),
  );
  const [service, setService] = useState<TimetableService>(() =>
    getActiveTimetableService(),
  );
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadStoredTimetable()
      .then(stored => {
        if (!cancelled && stored) {
          publish(stored);
          setTimetable(stored);
          setService(getActiveTimetableService());
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    const unsubscribe = subscribe(() => {
      if (!cancelled) {
        setTimetable(getActiveTimetable());
        setService(getActiveTimetableService());
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [version]);

  const refresh = useCallback(() => {
    setVersion(previous => previous + 1);
  }, []);

  return { timetable, service, ready, refresh };
}

/** Test/support hook: replace module state without touching storage. */
export function __setActiveTimetableForTests(timetable: Timetable): void {
  publish(timetable);
}
