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
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.myclassu.BuildConfig
import com.myclassu.R

/**
 * Full-screen class-start alarm, now also the attendance decision point
 * (Stage 7). Launched ONLY through the alarm notification's full-screen
 * intent, fully cold-start capable: every field travels in the launching
 * intent — no network, timetable, or React Native bridge involved.
 *
 * Two actions, no attendance UI beyond them:
 * - I'M IN CLASS: persists an attended record idempotently, silences the
 *   alert, removes the notification, finishes. Repeat-safe.
 * - I'M NOT IN CLASS: silences the alert immediately, then shows the
 *   native reason picker. Submit persists a skipped record idempotently;
 *   Cancel/back returns to the alarm view having saved nothing.
 *
 * Back on the alarm view dismisses without recording (occurrence still
 * consumed so the alarm never re-fires). All persistence is local-first
 * via [AttendanceStore]; upload is the JS sync layer's job, never a
 * precondition here.
 */
class ClassAlarmActivity : AppCompatActivity() {

  private companion object {
    const val TAG = "ClassAlarmActivity"
  }

  private data class AlarmPayload(
    val stableId: String,
    val sessionId: String,
    val dateKey: String,
    val subject: String,
    val courseCode: String,
    val startLabel: String,
    val endLabel: String,
    val room: String?,
    val instructor: String?,
    val isTest: Boolean,
  )

  private var mediaPlayer: MediaPlayer? = null
  private var audioFocusRequest: AudioFocusRequest? = null
  private var payload: AlarmPayload? = null
  private var selectedReason: String? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    showOverLockScreen()
    setContentView(R.layout.activity_class_alarm)
    findViewById<Button>(R.id.alarm_in_class).setOnClickListener { markAttended() }
    findViewById<Button>(R.id.alarm_not_in_class).setOnClickListener { showReasons() }
    findViewById<Button>(R.id.reason_submit).setOnClickListener { submitAbsence() }
    findViewById<Button>(R.id.reason_cancel).setOnClickListener { hideReasons() }
    bindFromIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Repeated launch (same occurrence re-armed, or a second class):
    // stop the previous sound first, reset the flow, bind the new payload.
    stopAlert()
    setIntent(intent)
    resetFlow()
    bindFromIntent(intent)
  }

  @Suppress("DEPRECATION")
  override fun onBackPressed() {
    if (isShowingReasons()) {
      // Cancel the reason flow only — nothing has been saved.
      hideReasons()
      return
    }
    // Leave without recording. The occurrence is still consumed (the alarm
    // must not re-fire); the decision stays pending for the app.
    consumeOccurrence()
    finish()
  }

  override fun onDestroy() {
    stopAlert()
    super.onDestroy()
  }

  // ------------------------------------------------------------------- flow

  private fun bindFromIntent(intent: Intent?) {
    val stableId = intent?.getStringExtra(ReminderContract.EXTRA_STABLE_ID)
    val sessionId = intent?.getStringExtra(ReminderContract.EXTRA_SESSION_ID).orEmpty()
    val dateKey = intent?.getStringExtra(ReminderContract.EXTRA_DATE_KEY).orEmpty()
    val subject = intent?.getStringExtra(ReminderContract.EXTRA_SUBJECT).orEmpty()
    if (stableId.isNullOrBlank() || subject.isBlank() ||
      sessionId.isBlank() || dateKey.isBlank()
    ) {
      // Never render an empty alarm screen; nothing to acknowledge.
      finish()
      return
    }
    payload = AlarmPayload(
      stableId = stableId,
      sessionId = sessionId,
      dateKey = dateKey,
      subject = subject,
      courseCode = intent.getStringExtra(ReminderContract.EXTRA_COURSE_CODE).orEmpty(),
      startLabel = intent.getStringExtra(ReminderContract.EXTRA_START_LABEL).orEmpty(),
      endLabel = intent.getStringExtra(ReminderContract.EXTRA_END_LABEL).orEmpty(),
      room = clean(intent.getStringExtra(ReminderContract.EXTRA_ROOM)),
      instructor = clean(intent.getStringExtra(ReminderContract.EXTRA_INSTRUCTOR)),
      isTest = intent.getBooleanExtra(ReminderContract.EXTRA_IS_TEST, false),
    )

    setText(R.id.alarm_subject, subject)
    setText(R.id.alarm_course_code, payload?.courseCode.orEmpty())
    setText(R.id.alarm_time, "${payload?.startLabel} – ${payload?.endLabel}")
    setOptionalText(R.id.alarm_room, payload?.room)
    setOptionalText(R.id.alarm_instructor, payload?.instructor)
    findViewById<View>(R.id.alarm_test_badge).visibility =
      if (payload?.isTest == true) View.VISIBLE else View.GONE

    startAlert()
  }

  private fun markAttended() {
    val current = payload ?: run {
      finish()
      return
    }
    val now = System.currentTimeMillis()
    val record = AttendanceContract.AttendanceRecord(
      id = AttendanceContract.recordId(current.sessionId, current.dateKey),
      sessionId = current.sessionId,
      dateKey = current.dateKey,
      courseCode = current.courseCode,
      subject = current.subject,
      classStartMillis = 0L,
      classEndMillis = 0L,
      status = AttendanceContract.STATUS_ATTENDED,
      reasonCategory = null,
      reasonText = null,
      markedAtMillis = now,
      updatedAtMillis = now,
      synced = false,
    )
    try {
      AttendanceStore.upsert(this, record)
    } catch (e: Exception) {
      // Storage failure must stay visible, never silent — and must never
      // trap the user on a ringing screen.
      Toast.makeText(this, "Couldn't save attendance — try in the app.", Toast.LENGTH_LONG).show()
      consumeOccurrence()
      finish()
      return
    }
    stopAlert()
    removeNotification(current.stableId)
    // Consumed: the occurrence must never re-fire.
    ClassReminderScheduler.forgetDelivered(this, current.stableId)
    payload = null
    finish()
  }

  private fun showReasons() {
    if (payload == null) {
      finish()
      return
    }
    // Silence now; the decision stays pending until submit or cancel.
    stopAlert()
    buildReasonList()
    findViewById<TextView>(R.id.reason_context).text = payload?.subject.orEmpty()
    findViewById<TextView>(R.id.reason_error).visibility = View.GONE
    findViewById<LinearLayout>(R.id.alarm_actions).visibility = View.GONE
    findViewById<LinearLayout>(R.id.reason_container).visibility = View.VISIBLE
  }

  private fun hideReasons() {
    findViewById<LinearLayout>(R.id.reason_container).visibility = View.GONE
    findViewById<LinearLayout>(R.id.alarm_actions).visibility = View.VISIBLE
  }

  private fun isShowingReasons(): Boolean =
    findViewById<LinearLayout>(R.id.reason_container).visibility == View.VISIBLE

  private fun buildReasonList() {
    val group = findViewById<RadioGroup>(R.id.reason_group)
    group.removeAllViews()
    group.setOnCheckedChangeListener { _, checkedId ->
      val reason = AttendanceContract.SKIP_REASONS.find { it.value.hashCode() == checkedId }
      selectedReason = reason?.value
      findViewById<TextView>(R.id.reason_error).visibility = View.GONE
      findViewById<EditText>(R.id.reason_custom).visibility =
        if (reason?.value == "other") View.VISIBLE else View.GONE
    }
    for (reason in AttendanceContract.SKIP_REASONS) {
      val radio = RadioButton(this).apply {
        // Stable view ID derived from the reason value (deterministic).
        id = reason.value.hashCode()
        text = reason.label
        textSize = 17f
        setTextColor(0xFFFFFFFF.toInt())
        setPadding(0, 18, 0, 18)
      }
      group.addView(radio)
    }
    selectedReason = null
    findViewById<EditText>(R.id.reason_custom).apply {
      setText("")
      visibility = View.GONE
    }
  }

  private fun submitAbsence() {
    val current = payload ?: run {
      finish()
      return
    }
    val reason = selectedReason
    if (reason == null) {
      findViewById<TextView>(R.id.reason_error).visibility = View.VISIBLE
      return
    }
    val custom = if (reason == "other") {
      findViewById<EditText>(R.id.reason_custom).text.toString().trim().takeUnless { it.isBlank() }
    } else {
      null
    }
    val problems = AttendanceContract.validateDecision(
      current.sessionId,
      current.dateKey,
      AttendanceContract.STATUS_SKIPPED,
      reason,
    )
    if (problems.isNotEmpty()) {
      findViewById<TextView>(R.id.reason_error).apply {
        text = problems.first()
        visibility = View.VISIBLE
      }
      return
    }
    val now = System.currentTimeMillis()
    val record = AttendanceContract.AttendanceRecord(
      id = AttendanceContract.recordId(current.sessionId, current.dateKey),
      sessionId = current.sessionId,
      dateKey = current.dateKey,
      courseCode = current.courseCode,
      subject = current.subject,
      classStartMillis = 0L,
      classEndMillis = 0L,
      status = AttendanceContract.STATUS_SKIPPED,
      reasonCategory = reason,
      reasonText = custom,
      markedAtMillis = now,
      updatedAtMillis = now,
      synced = false,
    )
    try {
      AttendanceStore.upsert(this, record)
    } catch (e: Exception) {
      Toast.makeText(this, "Couldn't save attendance — try in the app.", Toast.LENGTH_LONG).show()
      consumeOccurrence()
      finish()
      return
    }
    stopAlert()
    removeNotification(current.stableId)
    ClassReminderScheduler.forgetDelivered(this, current.stableId)
    payload = null
    finish()
  }

  private fun resetFlow() {
    payload = null
    selectedReason = null
    findViewById<LinearLayout>(R.id.reason_container).visibility = View.GONE
    findViewById<LinearLayout>(R.id.alarm_actions).visibility = View.VISIBLE
  }

  /** Terminal exit without a decision: silence, remove, consume, finish. */
  private fun consumeOccurrence() {
    val stableId = payload?.stableId
    stopAlert()
    if (stableId != null) {
      removeNotification(stableId)
      ClassReminderScheduler.forgetDelivered(this, stableId)
      payload = null
    }
  }

  private fun removeNotification(stableId: String) {
    try {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      manager?.cancel(ReminderContract.requestCode(stableId))
    } catch (e: SecurityException) {
      // Best effort only.
    }
  }

  private fun clean(value: String?): String? =
    value?.trim().takeUnless { it.isNullOrEmpty() || it == "null" }

  private fun setText(viewId: Int, value: String) {
    findViewById<TextView>(viewId).text = value
  }

  private fun setOptionalText(viewId: Int, value: String?) {
    val view = findViewById<TextView>(viewId)
    if (value == null) {
      view.visibility = View.GONE
    } else {
      view.visibility = View.VISIBLE
      view.text = value
    }
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
