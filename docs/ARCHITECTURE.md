# MyClassu — Architecture

This document describes how MyClassu is put together and, more importantly, _why_. It is a living document: each stage updates it to reflect reality, not aspiration.

## 1. Product architecture at a glance

```
┌─────────────────────────────────────────────────────────┐
│                      React Native (TS)                  │
│                                                         │
│  features/        navigation/      components/  design/  │
│  timetable        stack → screens  primitives   tokens    │
│  attendance                                        theme│
│  alarm / analytics / notifications / settings           │
│         │                       │                       │
│  domain/ models & rules    utils/ (timezone-aware time) │
└────────────────────────┬────────────────────────────────┘
                         │ native module boundary (Kotlin)
┌────────────────────────▼────────────────────────────────┐
│                 Native Android layer                    │
│   AlarmManager → BroadcastReceiver → AlarmActivity      │
└─────────────────────────────────────────────────────────┘
```

Layer rules:

- `domain/` has no React, no React Native, no persistence imports — pure models and rules.
- `features/` own their screens, data and logic; features do not import from each other directly (they share via `domain/` and future service interfaces).
- `components/` are visual primitives with **no business logic**.
- `App.tsx` stays tiny; `src/app/AppRoot.tsx` composes providers and navigation.

## 2. React Native layer

- **Bare React Native** (RN CLI workflow). The app needs custom native Android code (alarm scheduling, full-screen alarm activity), so Expo managed workflow is not an option; a bare RN project keeps native modules a first-class part of the architecture rather than a bolted-on prebuild step.
- TypeScript strict via `@react-native/typescript-config`; new architecture + Hermes enabled (defaults of the template).
- State: deliberately minimal. When attendance state grows, the preference is small feature-local stores over a global monolith.

## 3. Timetable engine (Stage 1)

The scheduling brain of the app lives in `src/features/timetable/engine/` — **pure functions** with three hard rules:

1. **No clocks.** Every function takes an explicit `Date` instant; only the service layer defaults to `new Date()`. This makes the whole engine deterministic and unit-testable.
2. **No device timezone.** All wall-clock math happens on "minutes since midnight" resolved via `Intl` in the timetable's own IANA zone (`Asia/Kolkata`, from `src/utils/time.ts`). A device set to UTC or America/New_York computes identical results.
3. **Fail fast on bad data.** Malformed times, end-before-start, unknown weekdays, or sessions pointing at missing courses throw `TimetableValidationError` (and the bound service validates the entire bundled timetable at construction).

**Interval convention — `[start, end)`:** a class is _current_ from its exact start minute (inclusive) to its exact end minute (exclusive). At 14:00 a 14:00–14:50 class is current; at 14:49 it is current; at 14:50 it has finished.

**Schedule status vs attendance status** — two independent lifecycles that must never be conflated:

| Concept          | Values                                             | Source                                               |
| ---------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Schedule state   | `upcoming` → `current` → `completed`               | Derived from the clock by the engine; never stored   |
| Attendance state | `attended` / `skipped` / `pending` / `unconfirmed` | A user decision per occurrence; stored (later stage) |

A completed class can still have no attendance decision; an attendance decision never changes because time passed.

Screens consume the bound **`timetableService`** (`getClassesForDay`, `getCurrentClass`, `getNextClass`, `getUpcomingClasses`, `getMinutesUntilClass`, …). Next-class resolution walks forward through the week: later same day → next day → weekend → the Friday→Monday gap, and never returns a class that already started.

**Local model denormalization (intentional):** the bundled timetable is a single module containing courses _and_ their sessions with room/instructor copied onto each session. That is deliberate — offline reads must be zero-join and zero-network, and room/instructor are genuinely per-session facts. The cloud model is normalized; the sync layer (future) maps between them.

### Timetable model

```
Course 1 ─── n ClassSession
                 weekday, startTime, endTime
                 room?, instructor?        ← per-session truth
```

- **Room and instructor live on the session, not the course.** The same course meets in different rooms on different days (e.g. 24CSEN4121 → ICT/305 Monday, ICT/118 Tuesday). The initial data preserves every such difference.
- Times are local "HH:mm" strings paired with the timetable's timezone — no epoch arithmetic.
- A session _occurrence_ (a session on a concrete date) is what attendance refers to: `ClassSession × local date`.

## 4. Native Android layer (current + future)

Currently the native layer is the RN template (Kotlin `MainActivity`/`MainApplication`, package `com.myclassu`), built with Gradle 9.x / AGP / JDK 21.

Future stages add, under `android/app/src/main/java/com/myclassu/`:

- **AlarmScheduler** (native module): turns reminder/alarm requests from JS into exact `AlarmManager` alarms (`setExactAndAllowWhileIdle`), with `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` handling.
- **AlarmBroadcastReceiver**: wakes on alarm fire; starts the alarm activity (or posts a full-screen-intent notification when the device is locked).
- **AlarmActivity**: the full-screen class alarm experience, shown over the lock screen where permitted.
- Re-scheduling after reboot via a `BOOT_COMPLETED` receiver, since `AlarmManager` alarms do not survive restarts.

### Why AlarmManager — and not JS timers

- **Process death.** Android may kill the app process any time it is backgrounded. A JS `setTimeout`/headless-task reminder dies with it. `AlarmManager` is held by the OS and fires regardless of process state.
- **Doze & battery optimization.** The device can defer or suspend JS execution for hours. `setExactAndAllowWhileIdle` is the OS-sanctioned way to fire at a precise time even in Doze.
- **Locked screen.** A class-start alarm must be able to wake the screen and present full-screen over the lock — that requires a native activity + full-screen intent, which JS cannot do.
- **Reliability contract.** The core promise of the product ("it reminds me, always") is a _system-scheduling_ problem, not an app-runtime problem. Any architecture built around JS timers would be structurally unable to keep that promise.

## 5. Local-first vs cloud (Supabase) — the split

The app must remain fully usable with Wi-Fi off, mobile data off, or Supabase down. The rule: **anything the reminder/alarm promise depends on is local; everything else is cloud.**

| Local source (SQLite/bundled data — always works) | Cloud source (Supabase — enhancement) |
| ------------------------------------------------- | ------------------------------------- |
| Timetable (bundled now, local DB later)           | User profile / account                |
| Today's schedule, current/next class              | Cloud backup & multi-device sync      |
| Upcoming-class calculation                        | Report generation jobs                |
| Alarm scheduling (AlarmManager)                   | Server-side functions, email delivery |

Concretely: `getSupabaseClient()` returns `null` when the app has no Supabase configuration, and every cloud-backed feature must treat that as a supported state — showing local data, never crashing, never blocking.

## 6. Supabase role & database architecture

`src/services/supabase/` is the **only** place that knows about Supabase:

- `env.ts` reads `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` from `.env` (react-native-config, build-time).
- `config.ts` validates that pair (pure, unit-tested). Unconfigured is a normal state, not an error.
- `client.ts` builds the single shared `SupabaseClient` (AsyncStorage-backed auth sessions, URL polyfill). Nothing else may call `createClient`.
- `database.types.ts` is the TypeScript mirror of the SQL schema.

The PostgreSQL side lives in `supabase/migrations/` as plain, ordered SQL files (reproducible from the repo; see `docs/DATABASE.md`): `profiles`, `courses`, `class_sessions`, `attendance_records`, `skip_reasons`, `notification_settings`, `email_settings` — each user-owned table with RLS scoped to `auth.uid()`, no permissive catch-alls.

**Secrets policy:** the publishable key is client-safe; the PostgreSQL password, the service-role key and any AgentMail API key are server-only and must never enter the app, `.env.example`, or Git.

## 7. Attendance model (Stages 7–8 implemented)

```
Local record:  id "<sessionId>|<dateKey>", sessionId, dateKey (YYYY-MM-DD
               Asia/Kolkata), courseCode, subject snapshot, class start/end
               millis, status attended | skipped, reasonCategory?,
               reasonText?, markedAt/updatedAt millis, synced flag
Cloud record:  attendance_records row (same columns + user_id), unique
               (class_session_id, date); SkipReasonCategory mirrors the
               shared skip_reasons defaults
```

- One record per session occurrence, locally and in the cloud. Local
  writes are upserts by stable ID (last write wins, never duplicates);
  uploads use upsert on the established unique key.
- Skip reasons are structured (`SkipReasonCategory` + shared defaults),
  so reason analytics are aggregations, never string parsing or inference.
- Analytics semantics (`src/features/attendance/analytics.ts`): only
  decided records count; upcoming classes are never in any denominator;
  percentage = attended / decided (null when undecided — never NaN);
  subjects group by course code; history filters all/attended/missed;
  trends use Monday-first weeks on record dateKeys with engine-provided
  scheduled counts; no projections are shown (they would mislead).
- Sync is an offline outbox (`attendanceSync`): local-first save, upload
  only with client + session + server session mapping, per-record retry.
  Local session IDs have no server uuids yet, so uploads defer as
  `unmapped` — documented, not attempted.

## 8. Future backend / email architecture

The daily report is planned as: local aggregation of the day's records → a server-side job (Supabase Edge Function) → email via an external mail service (AgentMail is the candidate). Any AgentMail credential lives only in the server environment behind a small `ReportSender` interface, and — per the offline-first rule — a failed email must never block or corrupt local attendance data.

## 9. Timezone strategy

- The timetable lives in `Asia/Kolkata` (stored in the timetable data and the user profile).
- All wall-clock resolution goes through `Intl` (`src/utils/time.ts`): `zonedParts` (weekday/minutes/dateKey in a zone), `addDays` (pure calendar shifts on the UTC-noon clock), `weekdayFromDateKey`.
- Midnight boundaries and UTC↔IST date shifts are covered by tests (e.g. 19:00 UTC is already "tomorrow" in IST).

## 10. Design system

- `src/design/tokens/` — raw palette, spacing, typography scale (9 roles), radii, motion (durations, easing curves, spring configs), elevation, opacity, z-index, icon sizes.
- `src/design/theme.ts` — semantic roles (surface hierarchy, text roles, accent, status colors, borders) mapped to light and dark values. Dark mode is layered (three surface levels + borders), never plain black-on-white.
- Components consume **only** semantic roles; finalizing the palette later means editing two role maps, not touching components.
- **Theme preference** (`system` / `light` / `dark`) lives in `ThemeProvider`; the Settings screen drives it. Persistence arrives with the settings stage.
- **Icons** are Lucide (`lucide-react-native` + `react-native-svg`) behind a small `Icon` component — one stroke-based visual language, sizes resolved through tokens. Emoji are never used as interface icons.

## 11. Motion & haptics (Stage 2 foundation)

- **Reanimated 4 + Worklets** and **Gesture Handler** are installed and configured (worklets babel plugin last in `babel.config.js`, `GestureHandlerRootView` at the app root, gesture-handler imported first in `index.js`).
- Motion is centralized in `src/design/motion/`: `usePressScale` (spring scale + opacity press feedback used by every touchable) and `Entrance` (fade + small directional travel for one-shot appearances). All durations/curves/springs come from tokens — no scattered animation values.
- **Every animation must justify itself** (feedback, hierarchy, continuity, state change). Decorative/infinite motion is excluded by policy; reduced-motion preference collapses entrances to instant appearance and disables press scale.
- Component-level motion: spring-driven tab indicator, spring toast entrance + swipe-to-dismiss, animated progress fill, calm skeleton pulse.
- **Haptics** are centralized in `src/design/haptics/haptics.ts` (`light/medium/success/warning/error/selection`) mapping to `react-native-haptic-feedback`; every call fails silently on unsupported devices. UI code never touches the native library.
- **Testing**: jest maps `react-native-reanimated` to a lightweight local mock (`jest/reanimated-mock.js`) — Reanimated 4's own test mock still boots its native chain under jest. Component tests assert behavior (accessible names, states, callbacks, lifecycle), not animation frames.

## 12. Navigation shell

- Root native stack: `Main` (tab shell) + temporary `DesignSystem` showcase (bottom-slide).
- Five primary destinations (Home, Schedule, Attendance, Stats, Settings) in a bottom tab navigator with a **custom compact tab bar** (`src/navigation/TabBar.tsx`): slim surface strip, hairline divider, icon + short label, and an accent indicator that springs to the active tab. Tab switches fire a selection haptic and are announced as tabs (`accessibilityRole="tab"`).
- Screen transitions: platform forward-push for detail screens, bottom-slide for the showcase, instant native switching between primary destinations.
