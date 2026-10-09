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
      ReminderContract.ACTION_SHOW_CLASS_START,
      ReminderContract.ACTION_SHOW_TEST_CLASS_START,
      -> showClassStart(context, intent)
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_TIME_CHANGED,
      -> ClassReminderScheduler.rescheduleAfterSystemEvent(context)
    }
  }

  /**
   * Class-start alarm fired. Posts the dedicated alarm notification with a
   * full-screen intent (the proper Android mechanism — never a direct
   * startActivity from the receiver) and forgets the occurrence so it can
   * never double-fire. The alarm Activity owns sound/vibration/dismissal.
   */
  private fun showClassStart(context: Context, intent: Intent) {
    val isTest = intent.getBooleanExtra(ReminderContract.EXTRA_IS_TEST, false) ||
      intent.action == ReminderContract.ACTION_SHOW_TEST_CLASS_START
    val subject = intent.getStringExtra(ReminderContract.EXTRA_SUBJECT).orEmpty()
    if (subject.isBlank()) {
      return
    }
    val stableId = intent.getStringExtra(ReminderContract.EXTRA_STABLE_ID)
      ?: return

    ReminderNotifications.ensureChannels(context)

    val alarmIntent = Intent(context, ClassAlarmActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(ReminderContract.EXTRA_STABLE_ID, stableId)
      putExtra(ReminderContract.EXTRA_SUBJECT, subject)
      putExtra(
        ReminderContract.EXTRA_COURSE_CODE,
        intent.getStringExtra(ReminderContract.EXTRA_COURSE_CODE).orEmpty(),
      )
      putExtra(
        ReminderContract.EXTRA_START_LABEL,
        intent.getStringExtra(ReminderContract.EXTRA_START_LABEL).orEmpty(),
      )
      putExtra(
        ReminderContract.EXTRA_END_LABEL,
        intent.getStringExtra(ReminderContract.EXTRA_END_LABEL).orEmpty(),
      )
      putExtra(ReminderContract.EXTRA_ROOM, intent.getStringExtra(ReminderContract.EXTRA_ROOM))
      putExtra(
        ReminderContract.EXTRA_INSTRUCTOR,
        intent.getStringExtra(ReminderContract.EXTRA_INSTRUCTOR),
      )
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
    val fullScreen = try {
      PendingIntent.getActivity(
        context,
        ReminderContract.requestCode(stableId),
        alarmIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    } catch (e: IllegalArgumentException) {
      return
    }

    val title = if (isTest) "Test: $subject" else subject
    val room = intent.getStringExtra(ReminderContract.EXTRA_ROOM)
      .takeUnless { it.isNullOrBlank() || it == "null" }
    val body = if (isTest) {
      "Class-start alarm test"
    } else {
      ReminderContract.classStartBody(
        intent.getStringExtra(ReminderContract.EXTRA_START_LABEL).orEmpty(),
        intent.getStringExtra(ReminderContract.EXTRA_END_LABEL).orEmpty(),
        room,
        intent.getStringExtra(ReminderContract.EXTRA_INSTRUCTOR),
      )
    }

    val notification = NotificationCompat.Builder(context, ReminderContract.ALARM_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_class_reminder)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      // No sound/vibration here: the alarm Activity owns both, so they
      // start and stop together with acknowledgement. The notification is
      // the persistent, ongoing entry point to that screen.
      .setSound(null)
      .setVibrate(longArrayOf())
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(fullScreen)
      .setFullScreenIntent(fullScreen, true)
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
