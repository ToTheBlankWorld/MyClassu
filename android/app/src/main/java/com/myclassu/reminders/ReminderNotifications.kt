package com.myclassu.reminders

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.os.Build

/**
 * Notification-channel ownership. Channels are created eagerly at schedule
 * time (so they are visible in system Settings immediately) and re-ensured
 * on every delivery before posting.
 *
 * Two channels, two jobs:
 * - reminders ("Class reminders"): calm 5-minute heads-up (Stage 5).
 * - alerts ("Class alerts"): the class-start alarm — alarm sound and
 *   vibration, backing the full-screen intent (Stage 6).
 */
object ReminderNotifications {

  fun ensureChannel(context: Context) {
    ensureReminderChannel(context)
  }

  fun ensureChannels(context: Context) {
    ensureReminderChannel(context)
    ensureAlarmChannel(context)
  }

  private fun ensureReminderChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return
    if (manager.getNotificationChannel(ReminderContract.CHANNEL_ID) != null) {
      return
    }
    val channel = NotificationChannel(
      ReminderContract.CHANNEL_ID,
      "Class reminders",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Reminders shortly before your scheduled classes start."
      enableVibration(true)
      // No custom sound, no full-screen intent: Stage 5 is a calm reminder,
      // not the class-start alarm (Stage 6 owns that experience).
    }
    manager.createNotificationChannel(channel)
  }

  private fun ensureAlarmChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return
    if (manager.getNotificationChannel(ReminderContract.ALARM_CHANNEL_ID) != null) {
      return
    }
    val channel = NotificationChannel(
      ReminderContract.ALARM_CHANNEL_ID,
      "Class alerts",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Full-screen alerts exactly when a class starts."
      enableVibration(true)
      // Alarm-appropriate sound/attributes; the alarm Activity plays the
      // actual looping sound, this keeps the channel itself alarm-like.
      setSound(
        android.media.RingtoneManager.getDefaultUri(
          android.media.RingtoneManager.TYPE_ALARM,
        ),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
    }
    manager.createNotificationChannel(channel)
  }
}
