import {
  SKIP_REASON_OPTIONS,
  attendanceRecordId,
  isKnownReasonCategory,
  toDomainRecord,
  type LocalAttendanceRecord,
} from './attendance';

/** Attendance model: identity, reason vocabulary, domain mapping. */
describe('attendance model', () => {
  it('derives deterministic occurrence identities', () => {
    expect(attendanceRecordId('s1', '2026-10-12')).toBe('s1|2026-10-12');
    expect(attendanceRecordId('s1', '2026-10-12')).toBe(
      attendanceRecordId('s1', '2026-10-12'),
    );
    // Same subject on different days → separate records.
    expect(attendanceRecordId('s-mon', '2026-10-12')).not.toBe(
      attendanceRecordId('s-mon', '2026-10-19'),
    );
  });

  it('exposes the shared-default reason vocabulary', () => {
    expect(SKIP_REASON_OPTIONS.map(option => option.value)).toEqual([
      'study',
      'work',
      'personal',
      'health',
      'overslept',
      'entertainment',
      'other',
    ]);
    expect(isKnownReasonCategory('health')).toBe(true);
    expect(isKnownReasonCategory('aliens')).toBe(false);
    expect(isKnownReasonCategory(undefined)).toBe(false);
  });

  it('maps an attended record onto the domain model', () => {
    const local: LocalAttendanceRecord = {
      id: 's1|2026-10-12',
      sessionId: 's1',
      dateKey: '2026-10-12',
      courseCode: 'MECH3271',
      subject: 'Total Quality Management',
      classStartMillis: 1000,
      classEndMillis: 2000,
      status: 'attended',
      markedAtMillis: 3000,
      updatedAtMillis: 4000,
      synced: false,
    };
    const domain = toDomainRecord(local);
    expect(domain).toMatchObject({
      id: 's1|2026-10-12',
      classSessionId: 's1',
      date: '2026-10-12',
      status: 'attended',
    });
    expect(domain.reasonCategory).toBeUndefined();
    expect(domain.markedAt).toBe(new Date(3000).toISOString());
  });

  it('maps a skipped record with reason onto the domain model', () => {
    const domain = toDomainRecord({
      id: 's1|2026-10-12',
      sessionId: 's1',
      dateKey: '2026-10-12',
      courseCode: 'MECH3271',
      subject: 'Total Quality Management',
      classStartMillis: 1000,
      classEndMillis: 2000,
      status: 'skipped',
      reasonCategory: 'health',
      reasonText: 'Fever',
      markedAtMillis: 3000,
      updatedAtMillis: 4000,
      synced: true,
    });
    expect(domain.status).toBe('skipped');
    expect(domain.reasonCategory).toBe('health');
    expect(domain.reasonText).toBe('Fever');
  });
});
