package com.myclassu.reminders

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.myclassu.BuildConfig

/**
 * Typed bridge for the authoritative local attendance store. The native
 * alarm path and the React Native UI both read/write [AttendanceStore] —
 * there is exactly one local database. Supabase upload happens only in
 * JS (see `attendanceSync`), never here: this module is offline-pure.
 */
class AttendanceModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * Record a decision for one occurrence. Expects:
   * { sessionId, dateKey, status, courseCode?, subject?, classStartMillis?,
   *   classEndMillis?, reasonCategory?, reasonText? }.
   * Idempotent: same occurrence overwrites (last write wins, fresh
   * timestamps), never duplicates. Resolves the saved record.
   */
  @ReactMethod
  fun submitAttendance(decision: ReadableMap?, promise: Promise) {
    try {
      if (decision == null) {
        promise.reject("INVALID_DECISION", "Missing decision payload.")
        return
      }
      val sessionId = decision.getString("sessionId").orEmpty()
      val dateKey = decision.getString("dateKey").orEmpty()
      val status = decision.getString("status").orEmpty()
      val reasonCategory = decision.getString("reasonCategory")
      val problems = AttendanceContract.validateDecision(
        sessionId,
        dateKey,
        status,
        reasonCategory,
      )
      if (problems.isNotEmpty()) {
        promise.reject("INVALID_DECISION", problems.joinToString("; "))
        return
      }
      val now = System.currentTimeMillis()
      val record = AttendanceContract.AttendanceRecord(
        id = AttendanceContract.recordId(sessionId, dateKey),
        sessionId = sessionId,
        dateKey = dateKey,
        courseCode = decision.getString("courseCode").orEmpty(),
        subject = decision.getString("subject").orEmpty(),
        classStartMillis = readLong(decision, "classStartMillis"),
        classEndMillis = readLong(decision, "classEndMillis"),
        status = status,
        reasonCategory = reasonCategory?.takeUnless { it.isBlank() },
        reasonText = decision.getString("reasonText")?.trim()?.takeUnless { it.isBlank() },
        markedAtMillis = now,
        updatedAtMillis = now,
        synced = false,
      )
      AttendanceStore.upsert(reactApplicationContext, record)
      promise.resolve(toMap(record))
    } catch (e: Exception) {
      promise.reject("SUBMIT_FAILED", e.message, e)
    }
  }

  /** All locally stored decisions, oldest first. */
  @ReactMethod
  fun getAttendance(promise: Promise) {
    try {
      val records = AttendanceStore.getAll(reactApplicationContext)
      promise.resolve(
        Arguments.createArray().apply {
          for (record in records) {
            pushMap(toMap(record))
          }
        },
      )
    } catch (e: Exception) {
      promise.reject("QUERY_FAILED", e.message, e)
    }
  }

  /** The decision for one occurrence, or null when undecided. */
  @ReactMethod
  fun getAttendanceForOccurrence(sessionId: String?, dateKey: String?, promise: Promise) {
    try {
      if (sessionId.isNullOrBlank() || dateKey.isNullOrBlank()) {
        promise.resolve(null as String?)
        return
      }
      val record = AttendanceStore.get(
        reactApplicationContext,
        AttendanceContract.recordId(sessionId, dateKey),
      )
      promise.resolve(record?.let { toMap(it) })
    } catch (e: Exception) {
      promise.reject("QUERY_FAILED", e.message, e)
    }
  }

  /** Offline outbox: decisions saved locally but not yet uploaded. */
  @ReactMethod
  fun getUnsyncedAttendance(promise: Promise) {
    try {
      val records = AttendanceStore.getUnsynced(reactApplicationContext)
      promise.resolve(
        Arguments.createArray().apply {
          for (record in records) {
            pushMap(toMap(record))
          }
        },
      )
    } catch (e: Exception) {
      promise.reject("QUERY_FAILED", e.message, e)
    }
  }

  /** Mark records uploaded. Resolves { marked }. */
  @ReactMethod
  fun markAttendanceSynced(recordIds: ReadableArray?, promise: Promise) {
    try {
      val ids = mutableListOf<String>()
      if (recordIds != null) {
        for (i in 0 until recordIds.size()) {
          recordIds.getString(i)?.let { ids += it }
        }
      }
      val marked = AttendanceStore.markSynced(reactApplicationContext, ids)
      promise.resolve(
        Arguments.createMap().apply {
          putInt("marked", marked)
        },
      )
    } catch (e: Exception) {
      promise.reject("SYNC_FAILED", e.message, e)
    }
  }

  /** DEVELOPMENT ONLY: wipe the local store. Refused in release builds. */
  @ReactMethod
  fun clearAttendance(promise: Promise) {
    if (!BuildConfig.DEBUG) {
      promise.reject("NOT_ALLOWED", "Clearing attendance is debug-only.")
      return
    }
    try {
      AttendanceStore.clearAll(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CLEAR_FAILED", e.message, e)
    }
  }

  private fun readLong(map: ReadableMap, key: String): Long {
    return try {
      if (!map.hasKey(key) || map.isNull(key)) {
        0L
      } else {
        map.getDouble(key).toLong()
      }
    } catch (e: Exception) {
      0L
    }
  }

  private fun toMap(record: AttendanceContract.AttendanceRecord) =
    Arguments.createMap().apply {
      putString("id", record.id)
      putString("sessionId", record.sessionId)
      putString("dateKey", record.dateKey)
      putString("courseCode", record.courseCode)
      putString("subject", record.subject)
      putDouble("classStartMillis", record.classStartMillis.toDouble())
      putDouble("classEndMillis", record.classEndMillis.toDouble())
      putString("status", record.status)
      putString("reasonCategory", record.reasonCategory)
      putString("reasonText", record.reasonText)
      putDouble("markedAtMillis", record.markedAtMillis.toDouble())
      putDouble("updatedAtMillis", record.updatedAtMillis.toDouble())
      putBoolean("synced", record.synced)
    }

  companion object {
    const val NAME = "Attendance"
  }
}
