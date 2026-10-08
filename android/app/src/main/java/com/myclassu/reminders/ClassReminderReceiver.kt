package com.myclassu.reminders

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.myclassu.MainActivity
import com.myclassu.R

/**
 * Single receiver for everything reminder-related:
 *
 * - [ReminderContract.ACTION_SHOW_REMINDER] / ACTION_SHOW_TEST_REMINDER:
 *   an AlarmManager alarm fired. Posts the notification (works with the app
 *   killed and the JS engine dead) and drops the delivered occurrence from
 *   persistence so it can never double-fire.
 * - BOOT_COMPLETED / TIMEZONE_CHANGED / TIME_SET: re-arms persisted future
 *   reminders from their source fields (idempotent, no duplicates).
 *
 * Exported=false: only the app's own alarms and the system can reach it.
 */
class ClassReminderReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent?) {
    if (intent == null) {
      return
    }
    when (intent.action) {
      ReminderContract.ACTION_SHOW_REMINDER,
      ReminderContract.ACTION_SHOW_TEST_REMINDER,
      -> showReminder(context, intent)
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_TIME_CHANGED,
      -> ClassReminderScheduler.rescheduleAfterSystemEvent(context)
    }
  }

  private fun showReminder(context: Context, intent: Intent) {
    val isTest = intent.getBooleanExtra(ReminderContract.EXTRA_IS_TEST, false) ||
      intent.action == ReminderContract.ACTION_SHOW_TEST_REMINDER
    val subject = intent.getStringExtra(ReminderContract.EXTRA_SUBJECT).orEmpty()
    if (subject.isBlank()) {
      return
    }
    val stableId = intent.getStringExtra(ReminderContract.EXTRA_STABLE_ID)
      ?: return
    val startLabel = intent.getStringExtra(ReminderContract.EXTRA_START_LABEL).orEmpty()
    val rawRoom = intent.getStringExtra(ReminderContract.EXTRA_ROOM)
    val room = rawRoom.takeUnless { it.isNullOrBlank() || it == "null" }

    ReminderNotifications.ensureChannel(context)

    val tapIntent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(
        ReminderContract.EXTRA_DATE_KEY,
        intent.getStringExtra(ReminderContract.EXTRA_DATE_KEY),
      )
      putExtra(
        ReminderContract.EXTRA_SESSION_ID,
        intent.getStringExtra(ReminderContract.EXTRA_SESSION_ID),
      )
      putExtra(ReminderContract.EXTRA_IS_TEST, isTest)
    }
    val tap = PendingIntent.getActivity(
      context,
      ReminderContract.requestCode(stableId),
      tapIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val title = if (isTest) "Test: $subject" else ReminderContract.notificationTitle(subject)
    val body = if (isTest) {
      startLabel
    } else {
      ReminderContract.notificationBody(startLabel, room)
    }

    val notification = NotificationCompat.Builder(context, ReminderContract.CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_class_reminder)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .setAutoCancel(true)
      .setContentIntent(tap)
      .build()

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
    try {
      manager?.notify(ReminderContract.requestCode(stableId), notification)
    } catch (e: SecurityException) {
      // Notifications revoked mid-flight: drop it, never crash the receiver.
      return
    }

    // Delivered: forget the occurrence so a later resync cannot re-fire it.
    if (!isTest) {
      ClassReminderScheduler.forgetDelivered(context, stableId)
    }
  }

}
