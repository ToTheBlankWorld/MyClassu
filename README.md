# MyClassu

A personal university class reminder, alarm, and attendance tracker — built for one user (me), optimized for calm reliability rather than flashy dashboards.

MyClassu answers the questions I actually forget: _Which class is right now? Where? Who teaches it? Did I attend it last time?_ And it does that proactively — with reminders and alarms — instead of making me open the app.

## Core idea

- **Offline-first.** The timetable is bundled structured data; the app never depends on a backend for core behavior.
- **Proactive, not passive.** A reminder before class, an alarm at class start, and a full-screen alarm experience — powered by native Android `AlarmManager` (not JS timers).
- **Honest attendance.** One tap: "I'm in class" or "I'm not attending" (with a reason). Daily, weekly and course-level history grows from those taps.
- **Calm, handcrafted UI.** Tokenized design system, natural motion, excellent dark/light modes. No generic dashboard aesthetics.

## Status

The project is developed in explicit stages. Each stage is committed and pushed when verified.

### Implemented (Stage 0 — foundation)

- React Native 0.87 (TypeScript, new architecture, Hermes), Android-first
- Design-token architecture: colors, spacing, typography scale, radii, motion tokens (light + dark themes)
- Core UI primitives: Text, Screen, Surface, Card, Button, IconButton, Badge, Divider, Stack/Row, EmptyState, LoadingState, toast foundation
- Navigation shell (React Navigation native stack with placeholder screens)
- Typed timetable model + the initial weekly timetable as structured local data (all 14 sessions, per-session rooms/instructors, lab and Project/Guide sessions included)
- Timezone-aware time utilities for `Asia/Kolkata`
- Unit tests (Jest), ESLint, Prettier, type-check wired up
- Android debug build verified; app launch verified on a physical device

### Planned (next stages)

- Today / weekly timetable UI with gesture-driven day switching
- Next-class information and live countdown
- Class reminders and the class-start alarm (native Android `AlarmManager` + `BroadcastReceiver` + full-screen alarm experience)
- Attendance marking ("I'm in class" / "I'm not attending") with skip reasons
- Attendance history and analytics (daily, weekly, course-level, skip reasons)
- Daily 6:00 PM report and email delivery
- Local persistence layer

### Future

- Cloud sync / backend
- iOS support

## Technology direction

- **React Native + TypeScript** (bare workflow — native modules are first-class citizens here, not an escape hatch)
- **Native Android layer (Kotlin)** where required: `AlarmManager` scheduling, `BroadcastReceiver`, full-screen alarm activity. JS timers are intentionally _not_ the alarm mechanism — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **React Navigation** for navigation; **Reanimated + Gesture Handler** planned for the motion stage
- **Jest** for unit tests; **ESLint + Prettier** for code health

## Project layout

```
src/
  app/          App composition root + placeholder screens
  components/   Reusable UI primitives (design system)
  design/       Design tokens, themes, theme provider
  domain/       Core models (Course, ClassSession, AttendanceRecord, …)
  features/     Feature modules (timetable, attendance, alarm, …)
  navigation/   Navigation architecture
  utils/        Framework-agnostic helpers (timezone-aware time, …)
android/        Native Android project (Kotlin)
docs/           Architecture & development documentation
```

`App.tsx` is intentionally tiny; everything real lives under `src/`.

## Local development

```sh
npm install          # install JS dependencies
npm start            # start Metro
npm run android      # build + install + launch on a connected device/emulator
```

Quality checks:

```sh
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format:check # prettier --check
npm test             # jest
```

### Android requirements

- JDK 21 (recommended; the machine's default JDK may be newer than what Gradle/AGP support)
- Android SDK with platform 37, build-tools 37.0.0; NDK is fetched automatically by the build
- `android/local.properties` with `sdk.dir` pointing at the SDK (never committed)

Details and the full command reference: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Git workflow

- `main` is the integration branch; stages land as clean, meaningful commits.
- Commit style: conventional-ish prefixes (`chore:`, `feat:`, `fix:`, `docs:`).
- Remote: HTTPS only (`https://github.com/ToTheBlankWorld/MyClassu.git`).

## License

Private, personal project.
