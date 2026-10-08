import type { Weekday } from '../domain/models';

/**
 * Timezone-aware helpers. The timetable is expressed in local university time
 * ("HH:mm" wall-clock strings + an IANA zone), never as UTC-derived Date math.
 */
const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse "HH:mm" (24h) into minutes since midnight; null when malformed. */
export function parseHHmm(value: string): number | null {
  const match = HHMM_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Format minutes-since-midnight as "HH:mm". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

const SHORT_WEEKDAYS: Record<string, Weekday> = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: 'sunday',
};

export interface ZonedParts {
  weekday: Weekday;
  /** Minutes since midnight in the zone */
  minutes: number;
  /** Local calendar date "YYYY-MM-DD" in the zone */
  dateKey: string;
}

/**
 * Resolve the wall-clock parts of an instant in a specific IANA timezone.
 * Uses Intl (not Date.getUTC*) so DST/offset quirks are handled by the ICU.
 */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = new Map<string, string>();
  for (const part of clock.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts.set(part.type, part.value);
    }
  }

  const weekday = SHORT_WEEKDAYS[parts.get('weekday') ?? ''];
  if (!weekday) {
    throw new Error(`Unrecognized weekday: ${parts.get('weekday')}`);
  }

  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  return {
    weekday,
    minutes: Number(parts.get('hour')) * 60 + Number(parts.get('minute')),
    dateKey,
  };
}

/** 0 = monday … 6 = sunday (matches the display order of WEEKDAYS). */
export function weekdayIndex(weekday: string): number {
  const index = WEEKDAY_INDEX[weekday];
  if (index === undefined) {
    throw new Error(`Invalid weekday: ${weekday}`);
  }
  return index;
}

const WEEKDAY_INDEX: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

/**
 * Shift a "YYYY-MM-DD" date key by whole days. Works on the UTC clock at
 * noon (immune to timezone offsets and DST), never touches local time.
 */
export function addDays(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const [, y, m, d] = match;
  const noonUtc = Date.UTC(Number(y), Number(m) - 1, Number(d), 12);
  const shifted = new Date(noonUtc + days * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Days from `fromWeekday` forward to `toWeekday` (0–6), wrapping a week. */
export function daysBetweenWeekdays(
  fromIndex: number,
  toIndex: number,
): number {
  return (toIndex - fromIndex + 7) % 7;
}

/**
 * Resolve the weekday of a "YYYY-MM-DD" calendar date. Pure calendar math on
 * the UTC clock (at noon) — independent of any timezone's offset.
 */
export function weekdayFromDateKey(dateKey: string): Weekday {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const [, y, m, d] = match;
  const utcDay = new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), 12),
  ).getUTCDay();
  // JS getUTCDay: 0 = sunday … 6 = saturday → convert to monday-first index.
  const index = (utcDay + 6) % 7;
  return WEEKDAY_NAMES[index];
}

const WEEKDAY_NAMES: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Format minutes-since-midnight as a 12-hour clock label, e.g. "2:00 PM". */
export function formatTime12h(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60 - 1) {
    throw new Error(`Invalid minutes of day: ${minutes}`);
  }
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) {
    hours12 = 12;
  }
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** Human duration, e.g. "42 min" or "1 h 5 min". */
export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) {
    return `${mins} min`;
  }
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}

/**
 * Full weekday/date label in a timezone, e.g. "Monday, 5 October".
 * Uses Intl so the wall-clock date matches the timetable's zone.
 */
export function formatDayLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}
