import {
  clearAttendance,
  getAttendanceForOccurrence,
  getAttendanceRecords,
  getUnsyncedAttendance,
  isAttendanceBridgeAvailable,
  markAttendanceSynced,
  submitAttendanceDecision,
} from './attendanceBridge';

/** Bridge behavior without the native module (Jest/iOS): degrade, don't crash. */
describe('attendanceBridge — native module absent', () => {
  it('reports the bridge as unavailable', () => {
    expect(isAttendanceBridgeAvailable()).toBe(false);
  });

  it('resolves empty reads instead of throwing', async () => {
    await expect(getAttendanceRecords()).resolves.toEqual([]);
    await expect(getUnsyncedAttendance()).resolves.toEqual([]);
    await expect(
      getAttendanceForOccurrence('s1', '2026-10-12'),
    ).resolves.toBeNull();
  });

  it('throws a clear error on writes without the bridge', async () => {
    await expect(
      submitAttendanceDecision({
        sessionId: 's1',
        dateKey: '2026-10-12',
        status: 'attended',
      }),
    ).rejects.toThrow('Attendance native module is unavailable');
    await expect(markAttendanceSynced(['s1|2026-10-12'])).rejects.toThrow(
      'Attendance native module is unavailable',
    );
    await expect(clearAttendance()).rejects.toThrow(
      'Attendance native module is unavailable',
    );
  });
});
