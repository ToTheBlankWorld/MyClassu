# MyClassu — Class Reminders (Stage 5)

Local, offline-first Android reminders that fire 5 minutes before each
scheduled class. No network, no Supabase, no JS timers — the OS owns
delivery.

## Architecture

```
TypeScript                        Kotlin (com.myclassu.reminders)
─────────────────────────────────────────────────────────────────
useClassReminders (app start) ──► ClassReminderModule (bridge)
buildReminderPayloads            ├─ ClassReminderScheduler (AlarmManager)
  └─ timetable engine               ├─ ClassReminderReceiver (notify + boot)
      getUpcomingClasses            └─ ReminderNotifications (channel)
```

- JS plans **what** (concrete occurrences from the timetable engine);
  native owns **when** (AlarmManager) and **how** (notification).
- The bridge accepts only serializable occurrence fields
  (`dateKey`, `sessionId`, `subject`, `startMinutes`, `startLabel`,
  optional `room`). Notification copy is formatted natively so it is
  identical whether the app is alive or dead.

## Scheduling

- One alarm per occurrence, 5 minutes before start (`triggerAtMillis`).
- Identity is deterministic: `<dateKey>|<sessionId>|reminder-5min`,
  `requestCode = stableId.hashCode()`, `FLAG_UPDATE_CURRENT |
FLAG_IMMUTABLE`. Re-syncing replaces; it can never duplicate.
- `replaceAll` cancels the persisted set first, skips past triggers,
  persists source fields (dateKey + startMinutes + display fields — never
  precomputed instants), and reports `{ scheduled, skippedPast, exact }`.
- Coverage: the engine yields each session's nearest occurrence per call,
  so JS unions three horizons (now, +7d, +14d) ≈ 42 alarms / ~3 weeks,
  deduplicated by stable ID and re-synced on every app start.
- Timezone: Asia/Kolkata wall-clock → UTC millis with an explicit zone
  (India has no DST). Any other zone fails fast in both layers.

## AlarmManager and exact alarms

- `setExactAndAllowWhileIdle(RTC_WAKEUP, …)` when
  `canScheduleExactAlarms()` is true (granted by default on the
  API-31 reference device; `window=0 exactAllowReason=permission` in
  `dumpsys alarm` confirms exact delivery).
- Manifest declares `SCHEDULE_EXACT_ALARM` (no `USE_EXACT_ALARM` — not
  needed and Play-restricted). Without the grant, the scheduler falls
  back to `setAndAllowWhileIdle` and reports `exact: false` honestly.
- No foreground service, no battery-exemption request, no permanent
  background work. Doze-friendly by using the intended alarm APIs.

## Notification channel

- `myclassu_class_reminders` / "Class reminders", `IMPORTANCE_HIGH`,
  vibration on, default sound, badge on. No custom sound, no full-screen
  intent — Stage 5 is a calm reminder; the class-start alarm is a later
  stage. Created eagerly at schedule time and re-ensured on delivery.
- Content: title = subject; body = `Starts in 5 minutes\n<time>[ ·
<room>]`. Blank/missing rooms omit the segment (never "null").
- Tap launches `MainActivity` (`singleTask` + `CLEAR_TOP`, no duplicate
  stacks) carrying `dateKey`/`sessionId` extras for future deep-linking.

## Permission

- `POST_NOTIFICATIONS` declared; requested at most once per install
  (persisted flag) via `ensureReminderPermission()`, only when not
  already granted. Pre-33 devices grant at install. Denial never crashes
  and never blocks the scheduler (alarms stay armed; delivery stays
  silent until the user grants).

## Boot / timezone / clock changes

- `RECEIVE_BOOT_COMPLETED` declared. One non-exported receiver handles
  `BOOT_COMPLETED`, `TIMEZONE_CHANGED`, and `TIME_SET` by recomputing
  triggers from persisted source fields and re-arming future reminders.
  Idempotent by deterministic identity.
- Note: Android cancels alarms on force-stop by design; the next app
  launch re-syncs the full set (verified on device).

## Offline behavior

Everything is local: bundled timetable → engine → bridge → AlarmManager.
Airplane mode changes nothing except Metro (dev only).

## Development test mechanism (debug only)

- `ClassReminderModule.scheduleTestReminder/cancelTestReminder` refuse
  non-debug builds (`BuildConfig.DEBUG` gate).
- Settings → Developer (rendered only when `__DEV__`) exposes
  "Schedule test reminder (30 s)" and "Cancel all reminders".
- Test alarms are never persisted: a reboot cannot resurrect them.
- Nothing in this section ships to users or release builds.

## Process-death note (fixed during Stage 5 verification)

Returning to the app after the OS (or `am kill`) destroyed its process
crashed on launch: `Screen fragments should never be restored`
(react-native-screens). `MainActivity.onCreate` now passes `null`
saved-state — React Native rebuilds all UI from JS, and rotation is
handled via `configChanges`, so nothing is lost. Verified with the
kill-and-restore scenario that previously crashed deterministically.
