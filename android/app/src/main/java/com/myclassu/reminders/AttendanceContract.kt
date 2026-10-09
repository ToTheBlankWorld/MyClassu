package com.myclassu.reminders

/**
 * Pure, framework-free attendance contract. Occurrence identity, reason
 * vocabulary, and record validation live here so they are deterministic
 * and JVM-unit-testable. Persistence itself ([AttendanceStore]) is the
 * only Android-coupled piece.
 *
 * One record per class occurrence: stable ID "<sessionId>|<dateKey>".
 * Reason vocabulary mirrors the shared `skip_reasons` defaults in
 * `20261006090002_attendance_and_skip_reasons.sql`.
 */
object AttendanceContract {

  /** Attendance decision values (match the Supabase status check). */
  const val STATUS_ATTENDED = "attended"
  const val STATUS_SKIPPED = "skipped"

  /** Reason value + human label, in display order. */
  data class SkipReason(val value: String, val label: String)

  val SKIP_REASONS: List<SkipReason> = listOf(
    SkipReason("study", "Study"),
    SkipReason("work", "Work"),
    SkipReason("personal", "Personal"),
    SkipReason("health", "Health"),
    SkipReason("overslept", "Overslept"),
    SkipReason("entertainment", "Entertainment"),
    SkipReason("other", "Other"),
  )

  /** Deterministic record identity for one concrete occurrence. */
  fun recordId(sessionId: String, dateKey: String): String = "$sessionId|$dateKey"

  private val DATE_KEY_PATTERN = Regex("""^\d{4}-\d{2}-\d{2}$""")

  /**
   * A locally persisted attendance decision. `synced=false` means "in the
   * offline outbox, awaiting upload". Field names mirror the Supabase
   * `attendance_records` columns (plus local snapshots and sync state).
   */
  data class AttendanceRecord(
    val id: String,
    val sessionId: String,
    val dateKey: String,
    val courseCode: String,
    val subject: String,
    val classStartMillis: Long,
    val classEndMillis: Long,
    val status: String,
    val reasonCategory: String?,
    val reasonText: String?,
    val markedAtMillis: Long,
    val updatedAtMillis: Long,
    val synced: Boolean,
  ) {
    /** Field map for persistence; string-only so any store works. */
    fun toFields(): Map<String, String> {
      val fields = mutableMapOf(
        "id" to id,
        "sessionId" to sessionId,
        "dateKey" to dateKey,
        "courseCode" to courseCode,
        "subject" to subject,
        "classStartMillis" to classStartMillis.toString(),
        "classEndMillis" to classEndMillis.toString(),
        "status" to status,
        "markedAtMillis" to markedAtMillis.toString(),
        "updatedAtMillis" to updatedAtMillis.toString(),
        "synced" to synced.toString(),
      )
      if (reasonCategory != null) {
        fields["reasonCategory"] = reasonCategory
      }
      if (reasonText != null) {
        fields["reasonText"] = reasonText
      }
      return fields
    }

    companion object {
      fun fromFields(fields: Map<String, String>): AttendanceRecord? {
        return try {
          val sessionId = fields["sessionId"] ?: return null
          val dateKey = fields["dateKey"] ?: return null
          val status = fields["status"] ?: return null
          AttendanceRecord(
            id = fields["id"] ?: recordId(sessionId, dateKey),
            sessionId = sessionId,
            dateKey = dateKey,
            courseCode = fields["courseCode"].orEmpty(),
            subject = fields["subject"].orEmpty(),
            classStartMillis = fields["classStartMillis"]?.toLongOrNull() ?: 0L,
            classEndMillis = fields["classEndMillis"]?.toLongOrNull() ?: 0L,
            status = status,
            reasonCategory = fields["reasonCategory"]?.takeUnless { it.isBlank() },
            reasonText = fields["reasonText"]?.takeUnless { it.isBlank() },
            markedAtMillis = fields["markedAtMillis"]?.toLongOrNull() ?: 0L,
            updatedAtMillis = fields["updatedAtMillis"]?.toLongOrNull() ?: 0L,
            synced = fields["synced"] == "true",
          )
        } catch (e: Exception) {
          null
        }
      }
    }
  }

  /** Human-readable problems with a decision payload (empty = valid). */
  fun validateDecision(
    sessionId: String?,
    dateKey: String?,
    status: String?,
    reasonCategory: String?,
  ): List<String> {
    val problems = mutableListOf<String>()
    if (sessionId.isNullOrBlank()) {
      problems += "Missing sessionId"
    }
    if (dateKey == null || !DATE_KEY_PATTERN.matches(dateKey)) {
      problems += "Invalid dateKey: $dateKey"
    }
    if (status != STATUS_ATTENDED && status != STATUS_SKIPPED) {
      problems += "Invalid status: $status"
    }
    if (status == STATUS_SKIPPED && reasonCategory != null &&
      SKIP_REASONS.none { it.value == reasonCategory }
    ) {
      problems += "Unknown reason category: $reasonCategory"
    }
    return problems
  }
}
