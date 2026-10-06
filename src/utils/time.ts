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
