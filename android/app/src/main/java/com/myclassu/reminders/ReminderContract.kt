package com.myclassu.reminders

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Pure, Android-framework-free contract for class reminders. Everything here
 * is deterministic and unit-testable on the JVM: stable alarm identities,
 * trigger-time math in the university timezone, and notification copy.
 *
 * The university timetable lives in Asia/Kolkata wall-clock time. India
 * observes no daylight saving, but all conversions below still go through
 * an explicit [TimeZone] so the math never depends on the device zone.
 */
object ReminderContract {

  /** University timezone for all reminder math. */
  const val TIMEZONE_ID = "Asia/Kolkata"

  /** Minutes before class start when the reminder fires. */
  const val LEAD_MINUTES_DEFAULT = 5L

  /** Stable alarm identity: "<dateKey>|<sessionId>|reminder-5min". */
  const val REMINDER_KIND = "reminder-5min"

  /**
   * Stable alarm identity: "<dateKey>|<sessionId>|class-start".
   * A different kind suffix from the reminder, so the two PendingIntents
   * (and notification IDs) for one occurrence can never collide.
   */
  const val CLASS_START_KIND = "class-start"

  /** AlarmReceiver action for a class reminder firing. */
  const val ACTION_SHOW_REMINDER = "com.myclassu.reminders.SHOW_REMINDER"

  /** AlarmReceiver action for a class-start alarm firing. */
  const val ACTION_SHOW_CLASS_START = "com.myclassu.reminders.SHOW_CLASS_START"

  /** AlarmReceiver action for a development-only test reminder firing. */
  const val ACTION_SHOW_TEST_REMINDER = "com.myclassu.reminders.SHOW_TEST_REMINDER"

  /** AlarmReceiver action for a development-only test class-start firing. */
  const val ACTION_SHOW_TEST_CLASS_START = "com.myclassu.reminders.SHOW_TEST_CLASS_START"

  /**
   * Fixed identity for the development-only test class-start alarm. Fixed
   * (not date-derived) on purpose: the cancel path must always resolve the
   * same PendingIntent, including across an IST midnight boundary. The
   * fired payload still carries the real IST date key and an unmistakably
   * fake session ID in its extras, so production validation runs
   * identically on test alarms.
   */
  const val TEST_CLASS_START_STABLE_ID = "dev-test|test-alarm|class-start"

  const val CHANNEL_ID = "myclassu_class_reminders"

  /** Dedicated channel for the class-start alarm (sound/vibration/FSI). */
  const val ALARM_CHANNEL_ID = "myclassu_class_alerts"

  const val EXTRA_STABLE_ID = "extra_stable_id"
  const val EXTRA_SUBJECT = "extra_subject"
  const val EXTRA_COURSE_CODE = "extra_course_code"
  const val EXTRA_START_LABEL = "extra_start_label"
  const val EXTRA_END_LABEL = "extra_end_label"
  const val EXTRA_ROOM = "extra_room"
  const val EXTRA_INSTRUCTOR = "extra_instructor"
  const val EXTRA_DATE_KEY = "extra_date_key"
  const val EXTRA_SESSION_ID = "extra_session_id"
  const val EXTRA_KIND = "extra_kind"
  const val EXTRA_IS_TEST = "extra_is_test"

  private val DATE_KEY_PATTERN = Regex("""^\d{4}-\d{2}-\d{2}$""")

  /** Deterministic alarm identity from a concrete occurrence. */
  fun stableId(dateKey: String, sessionId: String): String =
    "$dateKey|$sessionId|$REMINDER_KIND"

  /** Deterministic class-start identity — never equal to [stableId]. */
  fun classStartId(dateKey: String, sessionId: String): String =
    "$dateKey|$sessionId|$CLASS_START_KIND"

  /**
   * Deterministic PendingIntent/notification integer from a stable ID.
   * Kotlin [String.hashCode] is specified and stable across processes.
   */
  fun requestCode(stableId: String): Int = stableId.hashCode()

  /**
   * Absolute trigger instant for a class start expressed as a local date key
   * plus minutes-since-midnight in [TIMEZONE_ID], minus the lead time.
   */
  fun triggerAtMillis(
    dateKey: String,
    startMinutes: Int,
    leadMinutes: Long = LEAD_MINUTES_DEFAULT,
  ): Long {
    require(DATE_KEY_PATTERN.matches(dateKey)) { "Invalid date key: $dateKey" }
    require(startMinutes in 0 until 24 * 60) { "Invalid start minutes: $startMinutes" }
    require(leadMinutes >= 0) { "Invalid lead minutes: $leadMinutes" }
    val year = dateKey.substring(0, 4).toInt()
    val month = dateKey.substring(5, 7).toInt()
    val day = dateKey.substring(8, 10).toInt()
    val calendar = Calendar.getInstance(TimeZone.getTimeZone(TIMEZONE_ID)).apply {
      set(Calendar.YEAR, year)
      set(Calendar.MONTH, month - 1)
      set(Calendar.DAY_OF_MONTH, day)
      set(Calendar.HOUR_OF_DAY, startMinutes / 60)
      set(Calendar.MINUTE, startMinutes % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    return calendar.timeInMillis - leadMinutes * 60_000L
  }

  /** Notification title: the subject, nothing else. */
  fun notificationTitle(subject: String): String = subject

  /**
   * Class-start alarm body. Room/instructor segments are omitted when
   * missing — never "null".
   */
  fun classStartBody(
    startLabel: String,
    endLabel: String,
    room: String?,
    instructor: String?,
  ): String {
    val lines = mutableListOf("It's time for class", "$startLabel – $endLabel")
    val cleanRoom = room?.trim().takeUnless { it.isNullOrEmpty() || it == "null" }
    if (cleanRoom != null) {
      lines += cleanRoom
    }
    val cleanInstructor = instructor?.trim().takeUnless { it.isNullOrEmpty() || it == "null" }
    if (cleanInstructor != null) {
      lines += cleanInstructor
    }
    return lines.joinToString("\n")
  }

  /**
   * Notification body. Never renders "null"/"undefined": a missing or blank
   * room simply omits the room segment.
   */
  fun notificationBody(startLabel: String, room: String?): String {
    val line1 = "Starts in 5 minutes"
    val roomSegment = if (room.isNullOrBlank()) "" else " · ${room.trim()}"
    return "$line1\n$startLabel$roomSegment"
  }

  /**
   * Local "YYYY-MM-DD" date key for an absolute instant in the given zone.
   * Pure calendar math (UTC-based), independent of the device zone.
   */
  fun dateKeyFor(timeZoneId: String, nowMillis: Long): String {
    val calendar = Calendar.getInstance(TimeZone.getTimeZone(timeZoneId)).apply {
      timeInMillis = nowMillis
    }
    return "%04d-%02d-%02d".format(
      calendar.get(Calendar.YEAR),
      calendar.get(Calendar.MONTH) + 1,
      calendar.get(Calendar.DAY_OF_MONTH),
    )
  }

  /**
   * "2:00 PM" label for an absolute instant in the university timezone.
   * Uses [SimpleDateFormat] (available on all API levels, no desugaring).
   */
  fun formatStartLabel(triggerClassStartMillis: Long): String {
    val format = SimpleDateFormat("h:mm a", Locale.US).apply {
      timeZone = TimeZone.getTimeZone(TIMEZONE_ID)
    }
    return format.format(java.util.Date(triggerClassStartMillis))
  }

  /**
   * Validates a reminder payload map. Returns human-readable problems
   * (empty = valid) so the bridge can reject malformed input loudly
   * instead of scheduling a broken alarm.
   */
  fun validate(
    dateKey: String?,
    sessionId: String?,
    subject: String?,
    startMinutes: Int?,
  ): List<String> {
    val problems = mutableListOf<String>()
    if (dateKey == null || !DATE_KEY_PATTERN.matches(dateKey)) {
      problems += "Invalid dateKey: $dateKey"
    }
    if (sessionId.isNullOrBlank()) {
      problems += "Missing sessionId"
    }
    if (subject.isNullOrBlank()) {
      problems += "Missing subject"
    }
    if (startMinutes == null || startMinutes !in 0 until 24 * 60) {
      problems += "Invalid startMinutes: $startMinutes"
    }
    return problems
  }
}
