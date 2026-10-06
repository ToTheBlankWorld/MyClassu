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
- State: deliberately minimal in Stage 0. When attendance state grows, the preference is small feature-local stores over a global monolith.

## 3. Native Android layer (current + future)

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

## 4. Local / offline-first philosophy

- The timetable ships as typed local data (`src/features/timetable/data/timetable.ts`) and must never require a network call to render.
- Attendance records are written locally first; sync/email (later stages) is an _addition_, never a dependency.
- Time math uses `Intl` with an explicit IANA zone (`Asia/Kolkata`) instead of UTC-shifted `Date` arithmetic, so wall-clock times stay correct regardless of device timezone settings (see `src/utils/time.ts`).

## 5. Timetable model

```
Course 1 ─── n ClassSession
                 weekday, startTime, endTime
                 room?, instructor?        ← per-session truth
```

- **Room and instructor live on the session, not the course.** The same course meets in different rooms on different days (e.g. 24CSEN4121 → ICT/305 Monday, ICT/118 Tuesday). The initial data preserves every such difference.
- Times are local "HH:mm" strings paired with the timetable's timezone — no epoch arithmetic.
- A session _occurrence_ (a session on a concrete date) is what attendance refers to: `ClassSession × local date`.

## 6. Attendance model (designed now, implemented later)

```
AttendanceRecord: id, classSessionId, date (YYYY-MM-DD local),
                  status: attended | skipped,
                  reasonCategory?, reasonText?, markedAt (ISO instant)
```

- One record per session occurrence; creating/updating is idempotent per (classSessionId, date).
- Skip reasons are structured (`SkipReasonCategory`) + optional free text, so skip-reason analytics are queries over data, not string parsing.
- Daily/weekly/course-level statistics and the 6:00 PM report are derived views over these records.

## 7. Future backend / email architecture

The daily report is planned as: local aggregation of the day's records → email via an external mail service (AgentMail is the candidate). The app will hold any credentials in secure storage, the integration will be behind a small `ReportSender` service interface so the provider can be swapped, and — per the offline-first rule — a failed email must never block or corrupt local attendance data.

## 8. Design system

- `src/design/tokens/` — raw palette, spacing, typography scale, radii, motion (durations, easing curves, symbolic spring configs).
- `src/design/theme.ts` — semantic roles (surface hierarchy, text roles, accent, status colors, borders) mapped to light and dark values.
- Components consume **only** semantic roles; finalizing the palette later means editing two role maps, not touching components.
- Motion is a first-class requirement but every animation must justify itself; Reanimated + Gesture Handler arrive in the motion stage, and the spring tokens in `design/tokens/motion.ts` are written for that handoff.
