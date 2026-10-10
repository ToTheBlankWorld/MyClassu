package com.myclassu.reminders

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * JVM unit tests for the reminder contract: deterministic alarm identity,
 * Asia/Kolkata trigger math, notification copy, and malformed-input
 * rejection. No Android framework needed — pure logic only.
 */
class ReminderContractTest {

  @Test
  fun stableId_combinesDateSessionAndKind() {
    assertEquals(
      "2026-10-12|session-mech3271-mon-1000|reminder-5min",
      ReminderContract.stableId("2026-10-12", "session-mech3271-mon-1000"),
    )
  }

  @Test
  fun requestCode_isDeterministicAndDistinct() {
    val first = ReminderContract.requestCode("2026-10-12|s1|reminder-5min")
    assertEquals(first, ReminderContract.requestCode("2026-10-12|s1|reminder-5min"))
    val second = ReminderContract.requestCode("2026-10-12|s2|reminder-5min")
    val third = ReminderContract.requestCode("2026-10-13|s1|reminder-5min")
    assertTrue(first != second)
    assertTrue(first != third)
  }

  @Test
  fun triggerAtMillis_firesFiveMinutesBeforeStartInIst() {
    // Monday 2026-10-12, class at 10:00 IST → reminder at 09:55 IST.
    // IST is UTC+05:30, so 09:55 IST == 04:25 UTC.
    val trigger = ReminderContract.triggerAtMillis("2026-10-12", 10 * 60)
    val expected = utcMillis(2026, 10, 12, 4, 25)
    assertEquals(expected, trigger)
  }

  @Test
  fun triggerAtMillis_handlesAfternoonClass() {
    // 14:00 IST class → 13:55 IST == 08:25 UTC.
    val trigger = ReminderContract.triggerAtMillis("2026-10-05", 14 * 60)
    assertEquals(utcMillis(2026, 10, 5, 8, 25), trigger)
  }

  @Test
  fun triggerAtMillis_handlesEarlyMorningBoundary() {
    // 00:05 IST class → 00:00 IST == previous day 18:30 UTC.
    val trigger = ReminderContract.triggerAtMillis("2026-10-06", 5)
    assertEquals(utcMillis(2026, 10, 5, 18, 30), trigger)
  }

  @Test
  fun triggerAtMillis_respectsCustomLead() {
    val trigger = ReminderContract.triggerAtMillis("2026-10-12", 10 * 60, leadMinutes = 10)
    assertEquals(utcMillis(2026, 10, 12, 4, 20), trigger)
  }

  @Test(expected = IllegalArgumentException::class)
  fun triggerAtMillis_rejectsMalformedDateKey() {
    ReminderContract.triggerAtMillis("not-a-date", 600)
  }

  @Test(expected = IllegalArgumentException::class)
  fun triggerAtMillis_rejectsOutOfRangeMinutes() {
    ReminderContract.triggerAtMillis("2026-10-12", 24 * 60)
  }

  @Test
  fun notificationBody_includesRoomWhenPresent() {
    assertEquals(
      "Starts in 5 minutes\n2:00 PM · ICT / 606",
      ReminderContract.notificationBody("2:00 PM", "ICT / 606"),
    )
  }

  @Test
  fun notificationBody_omitsMissingRoom() {
    assertEquals(
      "Starts in 5 minutes\n9:00 AM",
      ReminderContract.notificationBody("9:00 AM", null),
    )
    assertEquals(
      "Starts in 5 minutes\n9:00 AM",
      ReminderContract.notificationBody("9:00 AM", "   "),
    )
  }

  @Test
  fun notificationTitle_isTheSubject() {
    assertEquals(
      "Advanced Computer Networks",
      ReminderContract.notificationTitle("Advanced Computer Networks"),
    )
  }

  @Test
  fun formatStartLabel_usesTwelveHourIstClock() {
    // 14:00 IST on 2026-10-05 == 08:30 UTC.
    assertEquals("2:00 PM", ReminderContract.formatStartLabel(utcMillis(2026, 10, 5, 8, 30)))
    assertEquals("9:00 AM", ReminderContract.formatStartLabel(utcMillis(2026, 10, 5, 3, 30)))
  }

  @Test
  fun classStartId_neverCollidesWithReminderId() {
    val reminder = ReminderContract.stableId("2026-10-12", "s1")
    val alarm = ReminderContract.classStartId("2026-10-12", "s1")
    assertEquals("2026-10-12|s1|reminder-5min", reminder)
    assertEquals("2026-10-12|s1|class-start", alarm)
    assertTrue(reminder != alarm)
    assertTrue(ReminderContract.requestCode(reminder) != ReminderContract.requestCode(alarm))
  }

  @Test
  fun testClassStartId_isFixedAndDistinct() {
    // The dev-only test alarm uses one fixed identity so its cancel path
    // always resolves the scheduled PendingIntent (a date-derived ID
    // would miss across midnight). It must never equal a production ID.
    assertEquals(
      "dev-test|test-alarm|class-start",
      ReminderContract.TEST_CLASS_START_STABLE_ID,
    )
    val production = ReminderContract.classStartId("2026-10-12", "s1")
    assertTrue(ReminderContract.TEST_CLASS_START_STABLE_ID != production)
    assertTrue(
      ReminderContract.requestCode(ReminderContract.TEST_CLASS_START_STABLE_ID) !=
        ReminderContract.requestCode(production),
    )
  }

  @Test
  fun dateKeyFor_resolvesIstCalendarDate() {
    // 2026-10-08 18:35 UTC == 2026-10-09 00:05 IST (past the IST midnight
    // boundary while still Oct 8 in UTC).
    val justAfterMidnightIst = utcMillis(2026, 10, 8, 18, 35)
    assertEquals(
      "2026-10-09",
      ReminderContract.dateKeyFor("Asia/Kolkata", justAfterMidnightIst),
    )
    assertEquals(
      "2026-10-08",
      ReminderContract.dateKeyFor("Asia/Kolkata", utcMillis(2026, 10, 8, 10, 0)),
    )
  }

  @Test
  fun classStartTrigger_firesExactlyAtStart() {
    // 14:00 IST class → alarm at 14:00:00.000 IST == 08:30 UTC.
    val trigger = ReminderContract.triggerAtMillis("2026-10-05", 14 * 60, leadMinutes = 0)
    assertEquals(utcMillis(2026, 10, 5, 8, 30), trigger)
  }

  @Test
  fun classStartBody_listsTimeRoomAndFaculty() {
    assertEquals(
      "It's time for class\n2:00 PM – 2:50 PM\nICT / 606\nTadi Srinivas",
      ReminderContract.classStartBody("2:00 PM", "2:50 PM", "ICT / 606", "Tadi Srinivas"),
    )
  }

  @Test
  fun classStartBody_omitsMissingRoomAndFaculty() {
    assertEquals(
      "It's time for class\n9:00 AM – 9:50 AM",
      ReminderContract.classStartBody("9:00 AM", "9:50 AM", null, null),
    )
    assertEquals(
      "It's time for class\n9:00 AM – 9:50 AM",
      ReminderContract.classStartBody("9:00 AM", "9:50 AM", "null", "  "),
    )
  }

  @Test
  fun validate_acceptsWellFormedPayload() {
    assertTrue(
      ReminderContract.validate("2026-10-12", "s1", "Subject", 600).isEmpty(),
    )
  }

  @Test
  fun validate_reportsEveryProblem() {
    val problems = ReminderContract.validate("nope", " ", "", -5)
    assertEquals(4, problems.size)
  }

  private fun utcMillis(year: Int, month: Int, day: Int, hour: Int, minute: Int): Long {
    val calendar = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
      set(java.util.Calendar.YEAR, year)
      set(java.util.Calendar.MONTH, month - 1)
      set(java.util.Calendar.DAY_OF_MONTH, day)
      set(java.util.Calendar.HOUR_OF_DAY, hour)
      set(java.util.Calendar.MINUTE, minute)
      set(java.util.Calendar.SECOND, 0)
      set(java.util.Calendar.MILLISECOND, 0)
    }
    return calendar.timeInMillis
  }
}
