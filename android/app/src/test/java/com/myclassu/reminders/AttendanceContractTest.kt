package com.myclassu.reminders

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * JVM unit tests for the attendance contract: deterministic occurrence
 * identity, decision validation, reason vocabulary, and field round-trip.
 * Persistence itself needs Android; it is verified on-device instead.
 */
class AttendanceContractTest {

  @Test
  fun recordId_combinesSessionAndDate() {
    assertEquals(
      "session-mech3271-mon-1000|2026-10-12",
      AttendanceContract.recordId("session-mech3271-mon-1000", "2026-10-12"),
    )
  }

  @Test
  fun recordId_separatesSameSubjectAcrossDays() {
    val monday = AttendanceContract.recordId("session-mech3271-mon-1000", "2026-10-12")
    val tuesday = AttendanceContract.recordId("session-mech3271-tue-1000", "2026-10-13")
    val nextMonday = AttendanceContract.recordId("session-mech3271-mon-1000", "2026-10-19")
    assertTrue(monday != tuesday)
    assertTrue(monday != nextMonday)
  }

  @Test
  fun skipReasons_coverTheSharedDefaults() {
    val values = AttendanceContract.SKIP_REASONS.map { it.value }
    assertEquals(
      listOf("study", "work", "personal", "health", "overslept", "entertainment", "other"),
      values,
    )
    assertTrue(AttendanceContract.SKIP_REASONS.all { it.label.isNotBlank() })
  }

  @Test
  fun validateDecision_acceptsAttendedWithoutReason() {
    assertTrue(
      AttendanceContract.validateDecision("s1", "2026-10-12", "attended", null).isEmpty(),
    )
  }

  @Test
  fun validateDecision_acceptsSkippedWithKnownReason() {
    assertTrue(
      AttendanceContract.validateDecision("s1", "2026-10-12", "skipped", "health").isEmpty(),
    )
  }

  @Test
  fun validateDecision_acceptsSkippedWithoutReason() {
    // Absence without a reason is permitted by the schema.
    assertTrue(
      AttendanceContract.validateDecision("s1", "2026-10-12", "skipped", null).isEmpty(),
    )
  }

  @Test
  fun validateDecision_rejectsUnknownReason() {
    val problems = AttendanceContract.validateDecision("s1", "2026-10-12", "skipped", "aliens")
    assertEquals(1, problems.size)
  }

  @Test
  fun validateDecision_reportsEveryProblem() {
    val problems = AttendanceContract.validateDecision("", "nope", "maybe", null)
    assertEquals(3, problems.size)
  }

  @Test
  fun record_roundTripsThroughFields() {
    val record = AttendanceContract.AttendanceRecord(
      id = AttendanceContract.recordId("s1", "2026-10-12"),
      sessionId = "s1",
      dateKey = "2026-10-12",
      courseCode = "MECH3271",
      subject = "Total Quality Management",
      classStartMillis = 1000L,
      classEndMillis = 2000L,
      status = AttendanceContract.STATUS_SKIPPED,
      reasonCategory = "health",
      reasonText = "Fever",
      markedAtMillis = 3000L,
      updatedAtMillis = 4000L,
      synced = false,
    )
    val restored = AttendanceContract.AttendanceRecord.fromFields(record.toFields())
    assertEquals(record, restored)
  }

  @Test
  fun record_omitsAbsentReasonFields() {
    val record = AttendanceContract.AttendanceRecord(
      id = AttendanceContract.recordId("s1", "2026-10-12"),
      sessionId = "s1",
      dateKey = "2026-10-12",
      courseCode = "CSEN3141",
      subject = "Advanced Computer Networks",
      classStartMillis = 1000L,
      classEndMillis = 2000L,
      status = AttendanceContract.STATUS_ATTENDED,
      reasonCategory = null,
      reasonText = null,
      markedAtMillis = 3000L,
      updatedAtMillis = 4000L,
      synced = false,
    )
    val fields = record.toFields()
    assertTrue(!fields.containsKey("reasonCategory"))
    assertTrue(!fields.containsKey("reasonText"))
    assertEquals(record, AttendanceContract.AttendanceRecord.fromFields(fields))
  }

  @Test
  fun record_rejectsMalformedFields() {
    assertNull(AttendanceContract.AttendanceRecord.fromFields(emptyMap()))
    assertNull(
      AttendanceContract.AttendanceRecord.fromFields(
        mapOf("sessionId" to "s1", "dateKey" to "2026-10-12"),
      ),
    )
  }
}
