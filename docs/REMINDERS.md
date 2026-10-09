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

## Class-start alarm (Stage 6)

At the exact class start, alongside the unchanged 5-minute reminder, the
scheduler arms a second, distinct event per occurrence:

- Reminder: `<dateKey>|<sessionId>|reminder-5min` → 5 min early → calm
  heads-up notification (Stage 5 behavior, untouched).
- Class-start: `<dateKey>|<sessionId>|class-start` → exact start →
  alarm notification + full-screen intent + native alarm Activity.

The two PendingIntents (and notification IDs) can never collide: the
kind suffix differs, so request codes differ. One JS payload arms both;
`getScheduledReminders` lists both; cancellation is scoped
(`cancelReminderAlarms` / `cancelClassStartAlarms` / `cancelAll`).

### AlarmManager → receiver → full-screen intent → activity

The receiver never launches an Activity directly. On
`SHOW_CLASS_START` it posts an ongoing, non-auto-cancel notification on
the dedicated `myclassu_class_alerts` channel ("Class alerts",
IMPORTANCE_HIGH, alarm sound/vibration attributes, `CATEGORY_ALARM`)
with `setFullScreenIntent(..., true)` targeting the single-instance
`ClassAlarmActivity`. The notification itself is silent and still —
sound/vibration are owned by the Activity so they start and stop
together with acknowledgement.

- Manifest declares `VIBRATE` and `USE_FULL_SCREEN_INTENT` (install
  grant for the alarm use-case). Without FSI access the notification
  still posts as an ongoing heads-up entry point — never a crash, never
  a false full-screen claim.
- Platform behavior (verified on the Redmi, API 31): screen off/locked
  → the system auto-launches the alarm Activity; screen on and app in
  use → heads-up, tap to open. No background Activity launches outside
  this mechanism, no foreground service, no polling.

### Alarm Activity

`ClassAlarmActivity` is fully cold-start capable: every visible field
(subject, code, times, room, faculty, IDs) travels in the launching
intent — no network, timetable, Metro, or bridge needed. Fixed dark
alarm theme (no cold-start flash), portrait, `singleInstance` (repeat
launches replace safely via `onNewIntent`), `excludeFromRecents`,
`showWhenLocked` + `turnScreenOn`, keeps screen on while active.
Back behaves as dismiss. Missing payload finishes immediately.

- Sound: looping `MediaPlayer` on the system default alarm ringtone
  (`USAGE_ALARM`), transient audio focus, released on dismiss/destroy.
  Skipped when the ringer is silent (vibration carries the alarm then).
- Vibration: 1s-on/1s-off repeating waveform (stronger than the
  reminder buzz), cancelled on dismiss/destroy.
- Dismiss ("Dismiss" button or back): stops sound + vibration, removes
  the ongoing notification, forgets the occurrence (no re-fire), records
  nothing (attendance is a later stage).

### Debug test alarms

`scheduleTestClassStart` / `cancelTestClassStart` (bridge +
`BuildConfig.DEBUG`-gated native, unpersisted) and Settings → Developer
(`__DEV__` only) buttons drive the real production path with a 30 s
fuse. Nothing here ships to users or release builds.

## Process-death note (fixed during Stage 5 verification)

Returning to the app after the OS (or `am kill`) destroyed its process
crashed on launch: `Screen fragments should never be restored`
(react-native-screens). `MainActivity.onCreate` now passes `null`
saved-state — React Native rebuilds all UI from JS, and rotation is
handled via `configChanges`, so nothing is lost. Verified with the
kill-and-restore scenario that previously crashed deterministically.
