# MyClassu — Development Guide

## Prerequisites

- **Node.js ≥ 22.11** (npm comes with it)
- **JDK 21** — install a JDK 21 LTS (e.g. Temurin). A system default JDK that is much newer than 21 can break Gradle/AGP.
- **Android SDK** — platform 37, build-tools 37.0.0, platform-tools. The NDK is fetched automatically by Gradle on first build.
- **local.properties** — `android/local.properties` must exist (not committed):

  ```properties
  sdk.dir=C\:\\path\\to\\Android\\Sdk
  ```

  Alternatively set the `ANDROID_HOME` environment variable.

## Commands

| Task                              | Command                                   |
| --------------------------------- | ----------------------------------------- |
| Install dependencies              | `npm install`                             |
| Start Metro                       | `npm start`                               |
| Build, install & launch (Android) | `npm run android`                         |
| Type-check                        | `npm run typecheck`                       |
| Lint                              | `npm run lint`                            |
| Format check / fix                | `npm run format:check` / `npm run format` |
| Unit tests                        | `npm test`                                |
| Debug APK only                    | `cd android && ./gradlew assembleDebug`   |

### Building Android directly with Gradle

If your default `java` is not JDK 21, point the build at one explicitly:

```sh
cd android
JAVA_HOME=/path/to/jdk-21 ./gradlew assembleDebug
```

The debug APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

### Running on a device

Enable USB debugging on the phone, connect it, then:

```sh
adb devices                        # verify the device is listed
npm run android                    # or:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.myclassu/.MainActivity
```

In debug builds Metro must be running (`npm start`); on a physical phone also run `adb reverse tcp:8081 tcp:8081` so the device can reach Metro over USB.

## Testing

- `npm test` runs Jest with the React Native preset.
- Stage 0 tests cover the bundled timetable data integrity (session count, per-session rooms, lab/project sessions) and the timezone-aware time utilities.
- Convention: unit-test everything in `domain/`, `utils/` and feature data/queries. Components get interaction tests once the component set stabilizes.

## Code style

- ESLint (`@react-native` config) — `npm run lint`; CI discipline: **zero errors**.
- Prettier — `npm run format` before committing if your editor does not format on save.
- TypeScript strict — no `any` unless proven necessary; no disabled lint rules without a written reason.

## Git workflow

- Branch: `main`.
- Commits: small, meaningful, imperative summary (`feat:`, `fix:`, `chore:`, `docs:` prefixes).
- Remote: **HTTPS only** — `https://github.com/ToTheBlankWorld/MyClassu.git` (no SSH).

```sh
git status                      # review what ships; never commit secrets
git add .
git commit -m "feat: ..."
git push origin main
```

## Stage workflow

Development proceeds in explicit stages agreed with the product owner:

1. Confirm the stage's scope (foundations → timetable UI → reminders/alarms → attendance → analytics → reports).
2. Implement, keeping `docs/ARCHITECTURE.md` in sync with reality.
3. Run all checks: `typecheck`, `lint`, `format:check`, `test`, and an Android build.
4. Verify on a physical device.
5. Commit and push `main` before moving to the next stage.

Do not start the next stage's work inside an unfinished stage.

## Troubleshooting

- **Gradle distribution download times out** — this machine has had flaky connectivity to `services.gradle.org`. The wrapper's `networkTimeout` is raised to 120000 ms; if it still fails, download the distribution manually and place it in `~/.gradle/wrapper/dists/`.
- **`Unsupported class file major version` / Gradle JVM errors** — the JVM running Gradle is too new. Use JDK 21 (`JAVA_HOME=... ./gradlew ...`).
- **Metro can't connect from a physical device** — run `adb reverse tcp:8081 tcp:8081`.
- **NDK missing** — Gradle auto-installs it when the license is accepted; open Android Studio's SDK manager once if it keeps prompting.
