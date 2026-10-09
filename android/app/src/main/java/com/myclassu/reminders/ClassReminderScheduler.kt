package com.myclassu.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject

/**
 * Owns all AlarmManager scheduling for class reminders (Stage 5) and
 * class-start alarms (Stage 6). The React Native layer only hands over
 * concrete occurrences; this object decides exact vs. inexact alarms,
 * persists the schedule for boot/time-change recovery, and guarantees
 * idempotency through deterministic PendingIntent identity.
 *
 * Two distinct event kinds per occurrence, never colliding:
 * - reminder:   "<dateKey>|<sessionId>|reminder-5min", fires 5 min early,
 *   posts a calm heads-up notification (existing Stage 5 behavior).
 * - class-start: "<dateKey>|<sessionId>|class-start", fires at the exact
 *   start, posts the alarm notification with a full-screen intent and
 *   launches the native alarm Activity.
 *
 * Persistence stores source fields (never precomputed instants), so after
 * reboot or a clock/timezone change triggers are recomputed from the real
 * class wall-clock time. Legacy Stage-5 records (no kind) are treated as
 * reminders; the next app-start sync replaces everything anyway.
 */
object ClassReminderScheduler {

  private const val PREFS_NAME = "myclassu_class_reminders"
  private const val KEY_IDS = "scheduled_ids"

  data class Occurrence(
    val dateKey: String,
    val sessionId: String,
    val subject: String,
    val courseCode: String,
    val startMinutes: Int,
    val endMinutes: Int,
    val startLabel: String,
    val endLabel: String,
    val room: String?,
    val instructor: String?,
  )

  data class ScheduleResult(
    val scheduled: Int,
    val skippedPast: Int,
    val exact: Boolean,
  )

  /**
   * Replace the entire schedule with [occurrences], arming a reminder and
   * a class-start alarm per occurrence. Malformed entries are skipped — one
   * bad payload never breaks the whole sync, and opening the app repeatedly
   * produces the identical alarm set.
   */
  fun replaceAll(context: Context, occurrences: List<Occurrence>): ScheduleResult {
    ReminderNotifications.ensureChannels(context)
    cancelPersisted(context)
    var scheduled = 0
    var skippedPast = 0
    val now = System.currentTimeMillis()
    for (occurrence in occurrences) {
      val problems = ReminderContract.validate(
        occurrence.dateKey,
        occurrence.sessionId,
        occurrence.subject,
        occurrence.startMinutes,
      )
      if (problems.isNotEmpty()) {
        continue
      }
      val reminderAt = ReminderContract.triggerAtMillis(
        occurrence.dateKey,
        occurrence.startMinutes,
      )
      if (reminderAt > now) {
        if (armReminder(context, occurrence, reminderAt, persist = true)) {
          scheduled++
        }
      } else {
        skippedPast++
      }
      val classStartAt = classStartMillis(occurrence)
      if (classStartAt > now) {
        if (armClassStart(context, occurrence, classStartAt, persist = true)) {
          scheduled++
        }
      } else {
        skippedPast++
      }
    }
    return ScheduleResult(
      scheduled = scheduled,
      skippedPast = skippedPast,
      exact = canScheduleExact(context),
    )
  }

  /** Cancel every reminder AND class-start alarm this scheduler owns. */
  fun cancelAll(context: Context): Int {
    return cancelPersisted(context)
  }

  /** Cancel only 5-minute reminders; class-start alarms are untouched. */
  fun cancelReminders(context: Context): Int {
    return cancelByKind(context, ReminderContract.REMINDER_KIND)
  }

  /** Cancel only class-start alarms; 5-minute reminders are untouched. */
  fun cancelClassStarts(context: Context): Int {
    return cancelByKind(context, ReminderContract.CLASS_START_KIND)
  }

  /** Persisted alarm IDs currently owned (both kinds; diagnostics/tests). */
  fun persistedIds(context: Context): Set<String> {
    return prefs(context).getStringSet(KEY_IDS, emptySet()) ?: emptySet()
  }

  /**
   * Drop one delivered alarm from persistence so a later resync can never
   * re-fire it. Called by the receiver/activity after delivery/acknowledge.
   */
  internal fun forgetDelivered(context: Context, stableId: String) {
    val p = prefs(context)
    val ids = p.getStringSet(KEY_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
    if (ids.remove(stableId)) {
      p.edit()
        .remove(keyFor(stableId))
        .putStringSet(KEY_IDS, ids)
        .apply()
    }
  }

  /**
   * Re-arm all persisted future alarms. Called after BOOT_COMPLETED /
   * TIMEZONE_CHANGED / TIME_SET. Idempotent: same deterministic identity,
   * FLAG_UPDATE_CURRENT, no duplicates.
   */
  fun rescheduleAfterSystemEvent(context: Context): Int {
    val stored = persistedIds(context).mapNotNull { readRecord(context, it) }
    // Clear first so a crash mid-loop cannot leave half-persisted state
    // that the next event would then duplicate.
    cancelPersisted(context)
    var rearmed = 0
    val now = System.currentTimeMillis()
    for ((kind, occurrence) in stored) {
      val triggerAt = when (kind) {
        ReminderContract.CLASS_START_KIND -> classStartMillis(occurrence)
        else -> ReminderContract.triggerAtMillis(occurrence.dateKey, occurrence.startMinutes)
      }
      if (triggerAt <= now) {
        continue
      }
      val armed = when (kind) {
        ReminderContract.CLASS_START_KIND ->
          armClassStart(context, occurrence, triggerAt, persist = true)
        else -> armReminder(context, occurrence, triggerAt, persist = true)
      }
      if (armed) {
        rearmed++
      }
    }
    return rearmed
  }

  /**
   * One-shot development reminder, NOT persisted (a reboot must never
   * resurrect test alarms). Production callers must not use this path.
   */
  fun scheduleTest(
    context: Context,
    triggerAtMillis: Long,
    title: String,
    body: String,
  ): Boolean {
    val stableId = "dev-test|test-reminder|${ReminderContract.REMINDER_KIND}"
    val intent = Intent(context, ClassReminderReceiver::class.java).apply {
      action = ReminderContract.ACTION_SHOW_TEST_REMINDER
      putExtra(ReminderContract.EXTRA_STABLE_ID, stableId)
      putExtra(ReminderContract.EXTRA_SUBJECT, title)
      putExtra(ReminderContract.EXTRA_START_LABEL, body)
      putExtra(ReminderContract.EXTRA_IS_TEST, true)
    }
    return setAlarm(context, stableId, triggerAtMillis, intent)
  }

  fun cancelTest(context: Context) {
    cancelByStableId(
      context,
      "dev-test|test-reminder|${ReminderContract.REMINDER_KIND}",
      ReminderContract.ACTION_SHOW_TEST_REMINDER,
    )
  }

  /**
   * One-shot development class-start alarm through the real production
   * path (AlarmManager → receiver → full-screen intent → alarm Activity),
   * NOT persisted. Production callers must not use this path.
   */
  fun scheduleTestClassStart(
    context: Context,
    triggerAtMillis: Long,
    subject: String,
    courseCode: String,
  ): Boolean {
    val stableId = "dev-test|test-alarm|${ReminderContract.CLASS_START_KIND}"
    val intent = classStartIntent(
      context,
      stableId,
      subject = subject,
      courseCode = courseCode,
      startLabel = "now",
      endLabel = "later",
      room = "ICT / TEST",
      instructor = "Test Faculty",
      dateKey = "dev-test",
      sessionId = "test-alarm",
      isTest = true,
    )
    return setAlarm(context, stableId, triggerAtMillis, intent)
  }

  fun cancelTestClassStart(context: Context) {
    cancelByStableId(
      context,
      "dev-test|test-alarm|${ReminderContract.CLASS_START_KIND}",
      ReminderContract.ACTION_SHOW_TEST_CLASS_START,
    )
  }

  // ---------------------------------------------------------------- internes

  private fun classStartMillis(occurrence: Occurrence): Long =
    ReminderContract.triggerAtMillis(occurrence.dateKey, occurrence.startMinutes, leadMinutes = 0)

  private fun reminderIntent(context: Context, stableId: String, occurrence: Occurrence): Intent =
    Intent(context, ClassReminderReceiver::class.java).apply {
      action = ReminderContract.ACTION_SHOW_REMINDER
      putExtra(ReminderContract.EXTRA_STABLE_ID, stableId)
      putExtra(ReminderContract.EXTRA_KIND, ReminderContract.REMINDER_KIND)
      putExtra(ReminderContract.EXTRA_SUBJECT, occurrence.subject)
      putExtra(ReminderContract.EXTRA_START_LABEL, occurrence.startLabel)
      putExtra(ReminderContract.EXTRA_ROOM, occurrence.room)
      putExtra(ReminderContract.EXTRA_DATE_KEY, occurrence.dateKey)
      putExtra(ReminderContract.EXTRA_SESSION_ID, occurrence.sessionId)
    }

  private fun classStartIntent(
    context: Context,
    stableId: String,
    subject: String,
    courseCode: String,
    startLabel: String,
    endLabel: String,
    room: String?,
    instructor: String?,
    dateKey: String,
    sessionId: String,
    isTest: Boolean,
  ): Intent = Intent(context, ClassReminderReceiver::class.java).apply {
    action = if (isTest) {
      ReminderContract.ACTION_SHOW_TEST_CLASS_START
    } else {
      ReminderContract.ACTION_SHOW_CLASS_START
    }
    putExtra(ReminderContract.EXTRA_STABLE_ID, stableId)
    putExtra(ReminderContract.EXTRA_KIND, ReminderContract.CLASS_START_KIND)
    putExtra(ReminderContract.EXTRA_SUBJECT, subject)
    putExtra(ReminderContract.EXTRA_COURSE_CODE, courseCode)
    putExtra(ReminderContract.EXTRA_START_LABEL, startLabel)
    putExtra(ReminderContract.EXTRA_END_LABEL, endLabel)
    putExtra(ReminderContract.EXTRA_ROOM, room)
    putExtra(ReminderContract.EXTRA_INSTRUCTOR, instructor)
    putExtra(ReminderContract.EXTRA_DATE_KEY, dateKey)
    putExtra(ReminderContract.EXTRA_SESSION_ID, sessionId)
    putExtra(ReminderContract.EXTRA_IS_TEST, isTest)
  }

  private fun armReminder(
    context: Context,
    occurrence: Occurrence,
    triggerAt: Long,
    persist: Boolean,
  ): Boolean {
    val stableId = ReminderContract.stableId(occurrence.dateKey, occurrence.sessionId)
    val armed = setAlarm(context, stableId, triggerAt, reminderIntent(context, stableId, occurrence))
    if (armed && persist) {
      writeRecord(context, stableId, ReminderContract.REMINDER_KIND, occurrence)
    }
    return armed
  }

  private fun armClassStart(
    context: Context,
    occurrence: Occurrence,
    triggerAt: Long,
    persist: Boolean,
  ): Boolean {
    val stableId = ReminderContract.classStartId(occurrence.dateKey, occurrence.sessionId)
    val intent = classStartIntent(
      context,
      stableId,
      subject = occurrence.subject,
      courseCode = occurrence.courseCode,
      startLabel = occurrence.startLabel,
      endLabel = occurrence.endLabel,
      room = occurrence.room,
      instructor = occurrence.instructor,
      dateKey = occurrence.dateKey,
      sessionId = occurrence.sessionId,
      isTest = false,
    )
    val armed = setAlarm(context, stableId, triggerAt, intent)
    if (armed && persist) {
      writeRecord(context, stableId, ReminderContract.CLASS_START_KIND, occurrence)
    }
    return armed
  }

  private fun setAlarm(
    context: Context,
    stableId: String,
    triggerAt: Long,
    intent: Intent,
  ): Boolean {
    return try {
      val pending = pendingIntent(context, stableId, intent, PendingIntent.FLAG_UPDATE_CURRENT)
        ?: return false
      val alarms = alarmManager(context) ?: return false
      if (canScheduleExact(context)) {
        alarms.setExactAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pending,
        )
      } else {
        // No exact-alarm access (or pre-S API): inexact but Doze-aware.
        // Delivery may drift; the result reports exact=false honestly.
        alarms.setAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          pending,
        )
      }
      true
    } catch (e: SecurityException) {
      false
    }
  }

  fun canScheduleExact(context: Context): Boolean {
    val alarms = alarmManager(context) ?: return false
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        alarms.canScheduleExactAlarms()
      } catch (e: SecurityException) {
        false
      }
    } else {
      true
    }
  }

  private fun pendingIntent(
    context: Context,
    stableId: String,
    intent: Intent,
    flags: Int,
  ): PendingIntent? {
    return try {
      PendingIntent.getBroadcast(
        context,
        ReminderContract.requestCode(stableId),
        intent,
        PendingIntent.FLAG_IMMUTABLE or flags,
      )
    } catch (e: IllegalArgumentException) {
      null
    }
  }

  private fun alarmManager(context: Context): AlarmManager? =
    context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

  // ------------------------------------------------------------- persistence

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun actionForKind(kind: String): String = when (kind) {
    ReminderContract.CLASS_START_KIND -> ReminderContract.ACTION_SHOW_CLASS_START
    else -> ReminderContract.ACTION_SHOW_REMINDER
  }

  private fun writeRecord(
    context: Context,
    stableId: String,
    kind: String,
    occurrence: Occurrence,
  ) {
    val json = JSONObject()
      .put("kind", kind)
      .put("dateKey", occurrence.dateKey)
      .put("sessionId", occurrence.sessionId)
      .put("subject", occurrence.subject)
      .put("courseCode", occurrence.courseCode)
      .put("startMinutes", occurrence.startMinutes)
      .put("endMinutes", occurrence.endMinutes)
      .put("startLabel", occurrence.startLabel)
      .put("endLabel", occurrence.endLabel)
      .put("room", occurrence.room)
      .put("instructor", occurrence.instructor)
      .toString()
    val p = prefs(context)
    val ids = p.getStringSet(KEY_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
    ids.add(stableId)
    p.edit()
      .putString(keyFor(stableId), json)
      .putStringSet(KEY_IDS, ids)
      .apply()
  }

  private fun readRecord(context: Context, stableId: String): Pair<String, Occurrence>? {
    return try {
      val raw = prefs(context).getString(keyFor(stableId), null) ?: return null
      val json = JSONObject(raw)
      // Stage-5 records carry no kind — they are reminders.
      val kind = json.optString("kind", ReminderContract.REMINDER_KIND)
      val room = json.optString("room", null)
      val instructor = json.optString("instructor", null)
      kind to Occurrence(
        dateKey = json.getString("dateKey"),
        sessionId = json.getString("sessionId"),
        subject = json.getString("subject"),
        courseCode = json.optString("courseCode", ""),
        startMinutes = json.getInt("startMinutes"),
        endMinutes = json.optInt("endMinutes", json.getInt("startMinutes")),
        startLabel = json.optString("startLabel", ""),
        endLabel = json.optString("endLabel", ""),
        // Guard against a literal "null" string ever reaching the UI.
        room = room.takeUnless { it.isNullOrBlank() || it == "null" },
        instructor = instructor.takeUnless { it.isNullOrBlank() || it == "null" },
      )
    } catch (e: Exception) {
      null
    }
  }

  private fun cancelByStableId(context: Context, stableId: String, action: String): Boolean {
    val intent = Intent(context, ClassReminderReceiver::class.java).apply {
      this.action = action
    }
    val pending = pendingIntent(context, stableId, intent, PendingIntent.FLAG_NO_CREATE)
    if (pending != null) {
      try {
        alarmManager(context)?.cancel(pending)
      } catch (e: SecurityException) {
        // Best effort only.
      }
      pending.cancel()
      return true
    }
    return false
  }

  private fun cancelByKind(context: Context, kind: String): Int {
    val p = prefs(context)
    val ids = p.getStringSet(KEY_IDS, emptySet()) ?: emptySet()
    var cancelled = 0
    val removed = mutableSetOf<String>()
    val editor = p.edit()
    for (stableId in ids) {
      val record = readRecord(context, stableId)
      val recordKind = record?.first ?: ReminderContract.REMINDER_KIND
      if (recordKind != kind) {
        continue
      }
      if (cancelByStableId(context, stableId, actionForKind(kind))) {
        cancelled++
      }
      editor.remove(keyFor(stableId))
      removed.add(stableId)
    }
    editor.putStringSet(KEY_IDS, ids - removed)
    editor.apply()
    return cancelled
  }

  private fun cancelPersisted(context: Context): Int {
    val p = prefs(context)
    val ids = p.getStringSet(KEY_IDS, emptySet()) ?: emptySet()
    var cancelled = 0
    val editor = p.edit()
    for (stableId in ids) {
      val record = readRecord(context, stableId)
      val kind = record?.first ?: ReminderContract.REMINDER_KIND
      if (cancelByStableId(context, stableId, actionForKind(kind))) {
        cancelled++
      }
      editor.remove(keyFor(stableId))
    }
    editor.remove(KEY_IDS)
    editor.apply()
    return cancelled
  }

  private fun keyFor(stableId: String): String = "occurrence:$stableId"
}
