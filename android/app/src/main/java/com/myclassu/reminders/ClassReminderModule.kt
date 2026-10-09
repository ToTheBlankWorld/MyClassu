package com.myclassu.reminders

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.myclassu.BuildConfig

/**
 * Minimal typed bridge for class reminders. The JS layer passes concrete
 * occurrences (already resolved from the timetable engine); every
 * AlarmManager decision lives in [ClassReminderScheduler].
 *
 * All methods are safe to call repeatedly: scheduling replaces the whole
 * set idempotently, and every method resolves (never hangs the JS promise).
 */
class ClassReminderModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * Replace the entire reminder schedule. Each entry:
   * { dateKey, sessionId, subject, startMinutes, startLabel, room? }.
   * Resolves { scheduled, skippedPast, exact }.
   */
  @ReactMethod
  fun scheduleReminders(reminders: ReadableArray?, promise: Promise) {
    try {
      val occurrences = mutableListOf<ClassReminderScheduler.Occurrence>()
      if (reminders != null) {
        for (i in 0 until reminders.size()) {
          val map = reminders.getMap(i) ?: continue
          occurrences += ClassReminderScheduler.Occurrence(
            dateKey = map.getString("dateKey").orEmpty(),
            sessionId = map.getString("sessionId").orEmpty(),
            subject = map.getString("subject").orEmpty(),
            courseCode = map.getString("courseCode").orEmpty(),
            startMinutes = if (map.hasKey("startMinutes")) map.getInt("startMinutes") else -1,
            endMinutes = if (map.hasKey("endMinutes")) {
              map.getInt("endMinutes")
            } else {
              -1
            },
            startLabel = map.getString("startLabel").orEmpty(),
            endLabel = map.getString("endLabel").orEmpty(),
            room = map.getString("room"),
            instructor = map.getString("instructor"),
          )
        }
      }
      val result = ClassReminderScheduler.replaceAll(reactApplicationContext, occurrences)
      promise.resolve(
        Arguments.createMap().apply {
          putInt("scheduled", result.scheduled)
          putInt("skippedPast", result.skippedPast)
          putBoolean("exact", result.exact)
        },
      )
    } catch (e: Exception) {
      promise.reject("SCHEDULE_FAILED", e.message, e)
    }
  }

  /** Cancel only 5-minute reminders; class-start alarms are untouched. */
  @ReactMethod
  fun cancelReminderAlarms(promise: Promise) {
    try {
      val cancelled = ClassReminderScheduler.cancelReminders(reactApplicationContext)
      promise.resolve(
        Arguments.createMap().apply {
          putInt("cancelled", cancelled)
        },
      )
    } catch (e: Exception) {
      promise.reject("CANCEL_FAILED", e.message, e)
    }
  }

  /** Cancel only class-start alarms; 5-minute reminders are untouched. */
  @ReactMethod
  fun cancelClassStartAlarms(promise: Promise) {
    try {
      val cancelled = ClassReminderScheduler.cancelClassStarts(reactApplicationContext)
      promise.resolve(
        Arguments.createMap().apply {
          putInt("cancelled", cancelled)
        },
      )
    } catch (e: Exception) {
      promise.reject("CANCEL_FAILED", e.message, e)
    }
  }

  /** Cancel every reminder AND class-start alarm this app owns. */
  @ReactMethod
  fun cancelAllReminders(promise: Promise) {
    try {
      val cancelled = ClassReminderScheduler.cancelAll(reactApplicationContext)
      promise.resolve(
        Arguments.createMap().apply {
          putInt("cancelled", cancelled)
        },
      )
    } catch (e: Exception) {
      promise.reject("CANCEL_FAILED", e.message, e)
    }
  }

  /** Persisted reminder IDs + trigger instants, for diagnostics and tests. */
  @ReactMethod
  fun getScheduledReminders(promise: Promise) {
    try {
      val ids = ClassReminderScheduler.persistedIds(reactApplicationContext)
      promise.resolve(
        Arguments.createArray().apply {
          for (id in ids.sorted()) {
            pushString(id)
          }
        },
      )
    } catch (e: Exception) {
      promise.reject("QUERY_FAILED", e.message, e)
    }
  }

  /** Whether exact alarms can be used on this device right now. */
  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    try {
      promise.resolve(ClassReminderScheduler.canScheduleExact(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("QUERY_FAILED", e.message, e)
    }
  }

  /**
   * DEVELOPMENT ONLY: fire a one-shot test notification after
   * [inSeconds]. Refused in release builds. Never persisted, so a reboot
   * cannot resurrect test alarms.
   */
  @ReactMethod
  fun scheduleTestReminder(title: String?, body: String?, inSeconds: Int, promise: Promise) {
    if (!BuildConfig.DEBUG) {
      promise.reject("NOT_ALLOWED", "Test reminders are debug-only.")
      return
    }
    try {
      val seconds = inSeconds.coerceIn(1, 3600)
      val triggerAt = System.currentTimeMillis() + seconds * 1000L
      val armed = ClassReminderScheduler.scheduleTest(
        reactApplicationContext,
        triggerAt,
        title.orEmpty().ifBlank { "Test reminder" },
        body.orEmpty().ifBlank { "This is what a class reminder feels like." },
      )
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("scheduled", armed)
          putDouble("triggerAt", triggerAt.toDouble())
        },
      )
    } catch (e: Exception) {
      promise.reject("TEST_SCHEDULE_FAILED", e.message, e)
    }
  }

  /** Cancel the development test reminder, if any. Debug only. */
  @ReactMethod
  fun cancelTestReminder(promise: Promise) {
    if (!BuildConfig.DEBUG) {
      promise.reject("NOT_ALLOWED", "Test reminders are debug-only.")
      return
    }
    try {
      ClassReminderScheduler.cancelTest(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("TEST_CANCEL_FAILED", e.message, e)
    }
  }

  /**
   * DEVELOPMENT ONLY: fire a one-shot test class-start alarm (real
   * production path: AlarmManager → receiver → full-screen intent →
   * alarm Activity) after [inSeconds]. Refused in release builds. Never
   * persisted, so a reboot cannot resurrect test alarms.
   */
  @ReactMethod
  fun scheduleTestClassStart(
    subject: String?,
    courseCode: String?,
    inSeconds: Int,
    promise: Promise,
  ) {
    if (!BuildConfig.DEBUG) {
      promise.reject("NOT_ALLOWED", "Test alarms are debug-only.")
      return
    }
    try {
      val seconds = inSeconds.coerceIn(1, 3600)
      val triggerAt = System.currentTimeMillis() + seconds * 1000L
      val armed = ClassReminderScheduler.scheduleTestClassStart(
        reactApplicationContext,
        triggerAt,
        subject.orEmpty().ifBlank { "Advanced Computer Networks" },
        courseCode.orEmpty().ifBlank { "CSEN3141" },
      )
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("scheduled", armed)
          putDouble("triggerAt", triggerAt.toDouble())
        },
      )
    } catch (e: Exception) {
      promise.reject("TEST_SCHEDULE_FAILED", e.message, e)
    }
  }

  /** Cancel the development test class-start alarm, if any. Debug only. */
  @ReactMethod
  fun cancelTestClassStart(promise: Promise) {
    if (!BuildConfig.DEBUG) {
      promise.reject("NOT_ALLOWED", "Test alarms are debug-only.")
      return
    }
    try {
      ClassReminderScheduler.cancelTestClassStart(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("TEST_CANCEL_FAILED", e.message, e)
    }
  }

  companion object {
    const val NAME = "ClassReminder"
  }
}
