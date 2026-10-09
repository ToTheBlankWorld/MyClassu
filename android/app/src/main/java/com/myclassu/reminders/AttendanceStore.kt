package com.myclassu.reminders

import android.content.Context
import org.json.JSONObject

/**
 * Authoritative local attendance store. Single source of truth for
 * attendance decisions on this device: the native alarm path writes here
 * even with the JS runtime dead, and the React Native layer reads (and
 * syncs) through the bridge — never a competing database.
 *
 * Durability: SharedPreferences (survives process death and reboot).
 * Identity: one record per occurrence
 * ([AttendanceContract.recordId]); writes are upserts, so replays,
 * double-taps, and duplicate intents can never duplicate a record.
 * Offline: no network involved at any point; `synced=false` marks the
 * upload outbox.
 */
object AttendanceStore {

  private const val PREFS_NAME = "myclassu_attendance"
  private const val KEY_IDS = "record_ids"

  /** Insert or replace the decision for its occurrence. Last write wins. */
  fun upsert(
    context: Context,
    record: AttendanceContract.AttendanceRecord,
  ): AttendanceContract.AttendanceRecord {
    val prefs = prefs(context)
    val ids = prefs.getStringSet(KEY_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
    ids.add(record.id)
    prefs.edit()
      .putString(keyFor(record.id), JSONObject(record.toFields()).toString())
      .putStringSet(KEY_IDS, ids)
      .apply()
    return record
  }

  fun get(context: Context, recordId: String): AttendanceContract.AttendanceRecord? {
    val raw = prefs(context).getString(keyFor(recordId), null) ?: return null
    return try {
      val json = JSONObject(raw)
      val fields = mutableMapOf<String, String>()
      val keys = json.keys()
      while (keys.hasNext()) {
        val key = keys.next()
        fields[key] = json.optString(key, "")
      }
      AttendanceContract.AttendanceRecord.fromFields(fields)
    } catch (e: Exception) {
      null
    }
  }

  fun getAll(context: Context): List<AttendanceContract.AttendanceRecord> {
    val ids = prefs(context).getStringSet(KEY_IDS, emptySet()) ?: emptySet()
    return ids.mapNotNull { get(context, it) }.sortedBy { it.markedAtMillis }
  }

  /** Outbox: decisions saved locally but not yet uploaded. */
  fun getUnsynced(context: Context): List<AttendanceContract.AttendanceRecord> {
    return getAll(context).filter { !it.synced }
  }

  /** Mark records uploaded. Returns how many were actually flipped. */
  fun markSynced(context: Context, recordIds: List<String>): Int {
    var flipped = 0
    for (id in recordIds) {
      val record = get(context, id) ?: continue
      if (!record.synced) {
        upsert(context, record.copy(synced = true, updatedAtMillis = System.currentTimeMillis()))
        flipped++
      }
    }
    return flipped
  }

  /** Debug/test only: wipe the local store. Gated at the bridge layer. */
  fun clearAll(context: Context) {
    prefs(context).edit().clear().apply()
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun keyFor(recordId: String): String = "record:$recordId"
}
