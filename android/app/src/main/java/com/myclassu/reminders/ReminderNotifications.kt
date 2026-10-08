package com.myclassu.reminders

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/**
 * Notification-channel ownership. The channel is created eagerly at
 * schedule time (so it is visible in system Settings immediately) and
 * re-ensured on every delivery before posting.
 */
object ReminderNotifications {

  fun ensureChannel(context: Context) {
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
      // not the class-start alarm (a later stage owns that experience).
    }
    manager.createNotificationChannel(channel)
  }
}
