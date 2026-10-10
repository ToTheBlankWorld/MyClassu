package com.myclassu.reminders

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
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
   * Replace the reminder schedule. Each entry:
   * { dateKey, sessionId, subject, startMinutes, startLabel, room? }.
   * `options` ({ reminders?: boolean, alarms?: boolean }) gates which
   * kinds are (re)scheduled — disabling one kind never touches the other.
   * Resolves { scheduled, skippedPast, exact }.
   */
  @ReactMethod
  fun scheduleReminders(
    reminders: ReadableArray?,
    options: ReadableMap?,
    promise: Promise,
  ) {
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
      // A disabled kind is left exactly as the user left it (toggles
      // cancel explicitly); an enabled kind is replaced idempotently.
      val enabledKinds = mutableSetOf<String>()
      if (optionsBoolean(options, "reminders", default = true)) {
        enabledKinds.add(ReminderContract.REMINDER_KIND)
      }
      if (optionsBoolean(options, "alarms", default = true)) {
        enabledKinds.add(ReminderContract.CLASS_START_KIND)
      }
      val result = ClassReminderScheduler.replaceAll(
        reactApplicationContext,
        occurrences,
        enabledKinds,
      )
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

  /** Persist alarm sound/vibration preferences for the alarm Activity. */
  @ReactMethod
  fun setAlarmSoundVibration(sound: Boolean, vibration: Boolean, promise: Promise) {
    try {
      AlarmPrefs.write(reactApplicationContext, sound, vibration)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("PREFS_FAILED", e.message, e)
    }
  }

  /** Open the app's system notification settings page. */
  @ReactMethod
  fun openNotificationSettings(promise: Promise) {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
          putExtra(Settings.EXTRA_APP_PACKAGE, reactApplicationContext.packageName)
        }
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:${reactApplicationContext.packageName}")
        }
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SETTINGS_FAILED", e.message, e)
    }
  }

  /**
   * Open the exact-alarm access page (API 31+), falling back to the app
   * details page. Some devices/OEMs hide the page — failure resolves
   * false instead of throwing so the UI can say so honestly.
   */
  @ReactMethod
  fun openExactAlarmSettings(promise: Promise) {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:${reactApplicationContext.packageName}")
        }
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:${reactApplicationContext.packageName}")
        }
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  private fun optionsBoolean(options: ReadableMap?, key: String, default: Boolean): Boolean {
    return try {
      if (options == null || !options.hasKey(key) || options.isNull(key)) {
        default
      } else {
        options.getBoolean(key)
      }
    } catch (e: Exception) {
      default
    }
  }

  companion object {
    const val NAME = "ClassReminder"
  }
}
