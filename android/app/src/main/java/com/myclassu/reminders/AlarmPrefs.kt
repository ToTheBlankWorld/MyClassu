package com.myclassu.reminders

import android.content.Context

/**
 * Alarm sound/vibration preferences, written from Settings and read by
 * [ClassAlarmActivity]. Stored separately from the JS AsyncStorage prefs
 * so the alarm path never depends on the React Native runtime.
 */
object AlarmPrefs {

  private const val PREFS_NAME = "myclassu_alarm_prefs"
  private const val KEY_SOUND = "sound_enabled"
  private const val KEY_VIBRATION = "vibration_enabled"

  data class Prefs(val soundEnabled: Boolean, val vibrationEnabled: Boolean)

  fun read(context: Context): Prefs {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return Prefs(
      soundEnabled = prefs.getBoolean(KEY_SOUND, true),
      vibrationEnabled = prefs.getBoolean(KEY_VIBRATION, true),
    )
  }

  fun write(context: Context, soundEnabled: Boolean, vibrationEnabled: Boolean) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_SOUND, soundEnabled)
      .putBoolean(KEY_VIBRATION, vibrationEnabled)
      .apply()
  }
}
