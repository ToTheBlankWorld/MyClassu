package com.myclassu.reminders

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.myclassu.BuildConfig
import com.myclassu.R

/**
 * Full-screen class-start alarm. Launched ONLY through the alarm
 * notification's full-screen intent (never directly from a receiver), and
 * fully capable of cold-starting with the app process dead: every visible
 * field travels in the launching intent, nothing touches the network, the
 * timetable, or the React Native bridge.
 *
 * While active it loops the system alarm sound and vibrates; DISMISS (or
 * back) stops both immediately, removes the ongoing notification, forgets
 * the occurrence (no re-fire, no attendance side effects — Stage 7 owns
 * those), and finishes. Re-launches replace the current alarm safely.
 */
class ClassAlarmActivity : AppCompatActivity() {

  private companion object {
    const val TAG = "ClassAlarmActivity"
  }

  private var mediaPlayer: MediaPlayer? = null
  private var audioFocusRequest: AudioFocusRequest? = null
  private var currentStableId: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    showOverLockScreen()
    setContentView(R.layout.activity_class_alarm)
    findViewById<Button>(R.id.alarm_dismiss).setOnClickListener { dismiss() }
    bindFromIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Repeated launch (same occurrence re-armed, or a second class):
    // stop the previous sound first, then bind the new payload.
    stopAlert()
    setIntent(intent)
    bindFromIntent(intent)
  }

  @Suppress("DEPRECATION")
  override fun onBackPressed() {
    dismiss()
  }

  override fun onDestroy() {
    stopAlert()
    super.onDestroy()
  }

  private fun bindFromIntent(intent: Intent?) {
    val stableId = intent?.getStringExtra(ReminderContract.EXTRA_STABLE_ID)
    val subject = intent?.getStringExtra(ReminderContract.EXTRA_SUBJECT).orEmpty()
    if (stableId.isNullOrBlank() || subject.isBlank()) {
      // Never render an empty alarm screen; nothing to acknowledge.
      finish()
      return
    }
    currentStableId = stableId
    val isTest = intent.getBooleanExtra(ReminderContract.EXTRA_IS_TEST, false)

    setText(R.id.alarm_subject, subject)
    setText(
      R.id.alarm_course_code,
      intent.getStringExtra(ReminderContract.EXTRA_COURSE_CODE).orEmpty(),
    )
    val startLabel = intent.getStringExtra(ReminderContract.EXTRA_START_LABEL).orEmpty()
    val endLabel = intent.getStringExtra(ReminderContract.EXTRA_END_LABEL).orEmpty()
    setText(R.id.alarm_time, "$startLabel – $endLabel")
    setOptionalText(R.id.alarm_room, intent.getStringExtra(ReminderContract.EXTRA_ROOM))
    setOptionalText(
      R.id.alarm_instructor,
      intent.getStringExtra(ReminderContract.EXTRA_INSTRUCTOR),
    )
    findViewById<View>(R.id.alarm_test_badge).visibility =
      if (isTest) View.VISIBLE else View.GONE

    startAlert()
  }

  private fun setText(viewId: Int, value: String) {
    findViewById<TextView>(viewId).text = value
  }

  private fun setOptionalText(viewId: Int, value: String?) {
    val clean = value?.trim().takeUnless { it.isNullOrEmpty() || it == "null" }
    val view = findViewById<TextView>(viewId)
    if (clean == null) {
      view.visibility = View.GONE
    } else {
      view.visibility = View.VISIBLE
      view.text = clean
    }
  }

  private fun dismiss() {
    val stableId = currentStableId
    stopAlert()
    if (stableId != null) {
      try {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        manager?.cancel(ReminderContract.requestCode(stableId))
      } catch (e: SecurityException) {
        // Best effort only.
      }
      // Acknowledged: the occurrence must never re-fire, and dismissal
      // records nothing (attendance belongs to a later stage).
      ClassReminderScheduler.forgetDelivered(this, stableId)
      currentStableId = null
    }
    finish()
  }

  // ------------------------------------------------------------------ alert

  private fun startAlert() {
    val audio = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    val silent = audio?.ringerMode == AudioManager.RINGER_MODE_SILENT
    if (!silent) {
      startSound(audio)
    }
    startVibration()
  }

  private fun startSound(audio: AudioManager?) {
    stopSound()
    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    if (BuildConfig.DEBUG) {
      android.util.Log.i(TAG, "startSound: uri=$uri silent-check-done")
    }
    if (uri == null) {
      return
    }
    try {
      if (audio != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build(),
          )
          .build()
        audio.requestAudioFocus(focus)
        audioFocusRequest = focus
      }
      mediaPlayer = MediaPlayer().apply {
        setDataSource(this@ClassAlarmActivity, uri)
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        isLooping = true
        prepare()
        start()
      }
      if (BuildConfig.DEBUG) {
        android.util.Log.i(TAG, "startSound: playing")
      }
    } catch (e: Exception) {
      // No audio hardware/decoder: vibration still carries the alarm.
      if (BuildConfig.DEBUG) {
        android.util.Log.w(TAG, "startSound failed: ${e.message}")
      }
      stopSound()
    }
  }

  private fun startVibration() {
    try {
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        manager?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      } ?: return
      if (!vibrator.hasVibrator()) {
        return
      }
      // Stronger than the reminder's default buzz: 1s on / 1s off, repeated.
      val pattern = longArrayOf(0, 1000, 1000)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
      } else {
        @Suppress("DEPRECATION")
        vibrator.vibrate(pattern, 0)
      }
    } catch (e: SecurityException) {
      // Vibration unavailable: sound still carries the alarm.
    }
  }

  private fun stopAlert() {
    stopSound()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        manager?.defaultVibrator?.cancel()
      } else {
        @Suppress("DEPRECATION")
        (getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator)?.cancel()
      }
    } catch (e: SecurityException) {
      // Best effort only.
    }
  }

  private fun stopSound() {
    try {
      mediaPlayer?.let {
        if (it.isPlaying) {
          it.stop()
        }
        it.release()
      }
    } catch (e: Exception) {
      // Already released: nothing to do.
    }
    mediaPlayer = null
    try {
      val audio = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        audioFocusRequest?.let { audio?.abandonAudioFocusRequest(it) }
      } else {
        @Suppress("DEPRECATION")
        audio?.abandonAudioFocus(null)
      }
    } catch (e: SecurityException) {
      // Best effort only.
    }
    audioFocusRequest = null
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }
}
