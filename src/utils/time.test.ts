import { formatMinutes, parseHHmm, zonedParts } from './time';

describe('parseHHmm', () => {
  it('parses valid 24h times into minutes since midnight', () => {
    expect(parseHHmm('09:00')).toBe(540);
    expect(parseHHmm('14:00')).toBe(840);
    expect(parseHHmm('00:00')).toBe(0);
    expect(parseHHmm('23:59')).toBe(1439);
  });

  it('rejects malformed times', () => {
    expect(parseHHmm('7:00')).toBeNull();
    expect(parseHHmm('24:00')).toBeNull();
    expect(parseHHmm('09:60')).toBeNull();
    expect(parseHHmm('ab:cd')).toBeNull();
    expect(parseHHmm('')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('formats minutes since midnight as HH:mm', () => {
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(540)).toBe('09:00');
    expect(formatMinutes(950)).toBe('15:50');
    expect(formatMinutes(1439)).toBe('23:59');
  });
});

describe('zonedParts', () => {
  it('resolves Asia/Kolkata wall-clock parts from a UTC instant', () => {
    // 2026-10-05T00:30:00Z is 06:00 IST on Monday, Oct 5th.
    const parts = zonedParts(new Date('2026-10-05T00:30:00Z'), 'Asia/Kolkata');
    expect(parts.weekday).toBe('monday');
    expect(parts.minutes).toBe(6 * 60);
    expect(parts.dateKey).toBe('2026-10-05');
  });

  it('crosses the UTC date boundary correctly', () => {
    // 2026-10-04T19:00:00Z is already 00:30 IST on Monday, Oct 5th.
    const parts = zonedParts(new Date('2026-10-04T19:00:00Z'), 'Asia/Kolkata');
    expect(parts.weekday).toBe('monday');
    expect(parts.minutes).toBe(30);
    expect(parts.dateKey).toBe('2026-10-05');
  });

  it('resolves a different timezone consistently', () => {
    // 2026-10-05T00:30:00Z is 2026-10-04 20:30 in New York (EDT).
    const parts = zonedParts(
      new Date('2026-10-05T00:30:00Z'),
      'America/New_York',
    );
    expect(parts.weekday).toBe('sunday');
    expect(parts.minutes).toBe(20 * 60 + 30);
    expect(parts.dateKey).toBe('2026-10-04');
  });
});
