package com.myclassu.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject

/**
 * Owns all AlarmManager scheduling for class reminders. The React Native
 * layer only hands over concrete occurrences; this object decides exact vs.
 * inexact alarms, persists the schedule for boot/time-change recovery, and
 * guarantees idempotency through deterministic PendingIntent identity.
 *
 * Identity: one alarm per [ReminderContract.stableId]; the PendingIntent
 * uses the stable request code with FLAG_UPDATE_CURRENT, so re-scheduling
 * the same occurrence replaces (never duplicates) the alarm.
 *
 * Persistence: every scheduled occurrence is stored in SharedPreferences as
 * its source fields (dateKey + startMinutes + display fields), NOT as a
 * precomputed instant. After reboot or a clock/timezone change, triggers
 * are recomputed from those fields, so alarms stay aligned with the real
 * class wall-clock time.
 */
object ClassReminderScheduler {

  private const val PREFS_NAME = "myclassu_class_reminders"
  private const val KEY_IDS = "scheduled_ids"

  data class Occurrence(
    val dateKey: String,
    val sessionId: String,
    val subject: String,
    val startMinutes: Int,
    val startLabel: String,
    val room: String?,
  )

  data class ScheduleResult(
    val scheduled: Int,
    val skippedPast: Int,
    val exact: Boolean,
  )

  /**
   * Replace the entire reminder schedule with [occurrences]. Malformed
   * entries are skipped (reported via [ScheduleResult]) — one bad payload
   * never breaks the whole sync, and opening the app repeatedly produces
   * the identical alarm set.
   */
  fun replaceAll(context: Context, occurrences: List<Occurrence>): ScheduleResult {
    ReminderNotifications.ensureChannel(context)
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
      val triggerAt = ReminderContract.triggerAtMillis(
        occurrence.dateKey,
        occurrence.startMinutes,
      )
      if (triggerAt <= now) {
        skippedPast++
        continue
      }
      if (arm(context, occurrence, triggerAt, persist = true)) {
        scheduled++
      }
    }
    return ScheduleResult(
      scheduled = scheduled,
      skippedPast = skippedPast,
      exact = canScheduleExact(context),
    )
  }

  /** Cancel every reminder this scheduler owns. */
  fun cancelAll(context: Context): Int {
    return cancelPersisted(context)
  }

  /** Occurrence IDs currently persisted (for diagnostics/tests). */
  fun persistedIds(context: Context): Set<String> {
    return prefs(context).getStringSet(KEY_IDS, emptySet()) ?: emptySet()
  }

  /**
   * Drop one delivered occurrence from persistence so a later resync can
   * never re-fire it. Called by the receiver after posting.
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
   * Re-arm all persisted reminders whose triggers are still in the future.
   * Called after BOOT_COMPLETED / TIMEZONE_CHANGED / TIME_SET. Idempotent:
   * same deterministic identity, FLAG_UPDATE_CURRENT, no duplicates.
   */
  fun rescheduleAfterSystemEvent(context: Context): Int {
    val stored = persistedIds(context).mapNotNull { readOccurrence(context, it) }
    // Clear first so a crash mid-loop cannot leave half-persisted state
    // that the next event would then duplicate.
    cancelPersisted(context)
    var rearmed = 0
    val now = System.currentTimeMillis()
    for (occurrence in stored) {
      val triggerAt = ReminderContract.triggerAtMillis(
        occurrence.dateKey,
        occurrence.startMinutes,
      )
      if (triggerAt > now && arm(context, occurrence, triggerAt, persist = true)) {
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
    val stableId = "dev-test|test-reminder|${ReminderContract.REMINDER_KIND}"
    val intent = Intent(context, ClassReminderReceiver::class.java).apply {
      action = ReminderContract.ACTION_SHOW_TEST_REMINDER
    }
    val pending = pendingIntent(context, stableId, intent, PendingIntent.FLAG_NO_CREATE)
    if (pending != null) {
      try {
        alarmManager(context)?.cancel(pending)
      } catch (e: SecurityException) {
        // Best effort only.
      }
      pending.cancel()
    }
  }

  // ---------------------------------------------------------------- internes

  private fun arm(
    context: Context,
    occurrence: Occurrence,
    triggerAt: Long,
    persist: Boolean,
  ): Boolean {
    val stableId = ReminderContract.stableId(occurrence.dateKey, occurrence.sessionId)
    val intent = Intent(context, ClassReminderReceiver::class.java).apply {
      action = ReminderContract.ACTION_SHOW_REMINDER
      putExtra(ReminderContract.EXTRA_STABLE_ID, stableId)
      putExtra(ReminderContract.EXTRA_SUBJECT, occurrence.subject)
      putExtra(ReminderContract.EXTRA_START_LABEL, occurrence.startLabel)
      putExtra(ReminderContract.EXTRA_ROOM, occurrence.room)
      putExtra(ReminderContract.EXTRA_DATE_KEY, occurrence.dateKey)
      putExtra(ReminderContract.EXTRA_SESSION_ID, occurrence.sessionId)
    }
    val armed = setAlarm(context, stableId, triggerAt, intent)
    if (armed && persist) {
      writeOccurrence(context, stableId, occurrence)
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

  private fun writeOccurrence(context: Context, stableId: String, occurrence: Occurrence) {
    val json = JSONObject()
      .put("dateKey", occurrence.dateKey)
      .put("sessionId", occurrence.sessionId)
      .put("subject", occurrence.subject)
      .put("startMinutes", occurrence.startMinutes)
      .put("startLabel", occurrence.startLabel)
      .put("room", occurrence.room)
      .toString()
    val p = prefs(context)
    val ids = p.getStringSet(KEY_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
    ids.add(stableId)
    p.edit()
      .putString(keyFor(stableId), json)
      .putStringSet(KEY_IDS, ids)
      .apply()
  }

  private fun readOccurrence(context: Context, stableId: String): Occurrence? {
    return try {
      val raw = prefs(context).getString(keyFor(stableId), null) ?: return null
      val json = JSONObject(raw)
      val rawRoom = json.optString("room", null)
      Occurrence(
        dateKey = json.getString("dateKey"),
        sessionId = json.getString("sessionId"),
        subject = json.getString("subject"),
        startMinutes = json.getInt("startMinutes"),
        startLabel = json.optString("startLabel", ""),
        // Guard against a literal "null" string ever reaching the UI.
        room = rawRoom.takeUnless { it.isNullOrBlank() || it == "null" },
      )
    } catch (e: Exception) {
      null
    }
  }

  private fun cancelPersisted(context: Context): Int {
    val p = prefs(context)
    val ids = p.getStringSet(KEY_IDS, emptySet()) ?: emptySet()
    var cancelled = 0
    val editor = p.edit()
    for (stableId in ids) {
      val intent = Intent(context, ClassReminderReceiver::class.java).apply {
        action = ReminderContract.ACTION_SHOW_REMINDER
      }
      val pending = pendingIntent(context, stableId, intent, PendingIntent.FLAG_NO_CREATE)
      if (pending != null) {
        try {
          alarmManager(context)?.cancel(pending)
        } catch (e: SecurityException) {
          // Best effort: still drop our persisted record below.
        }
        pending.cancel()
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
