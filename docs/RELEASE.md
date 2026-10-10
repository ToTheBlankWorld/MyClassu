# MyClassu — Production Release (Stage 12)

How to build, sign, verify, and ship MyClassu for Android. The first
signed release is `versionCode 1` / `versionName "1.0"`, signed with a
dedicated local keystore (`CN=MyClassu`, RSA-2048, valid to 2056).

## Toolchain

- JDK 21 recommended for Gradle/AGP (this machine also has JDK 26; the
  release keystore was created with the JDK 26 `keytool` — keystores
  are JDK-independent PKCS#12 files).
- Android SDK: platform 37, build-tools 37.0.0, NDK auto-fetched.
- Gradle 9.4.1 (wrapper), Android Gradle Plugin per version catalog.
- `android/local.properties` must point `sdk.dir` at the SDK (never
  committed).

## Versioning

- `applicationId` is `com.myclassu` and must never change (local
  AsyncStorage data, alarm PendingIntent identities, and installed-app
  upgrade compatibility all key off it).
- Current release: `versionCode 1`, `versionName "1.0"`
  (`android/app/build.gradle` → `defaultConfig`).
- Future releases: increment `versionCode` by exactly 1 every release
  (Play requires a strictly increasing integer); bump `versionName`
  for humans (`1.1`, `1.2`, …). Update both in the same commit as the
  release notes, never for debug-only work.

## Signing (secure)

- Release keystore: `android/myclassu-release.keystore` (PKCS#12,
  alias `myclassu`). **Gitignored, local-only, backed up offline.**
  Losing it means the app can never be updated in place again.
- Credentials live ONLY in `android/keystore.properties` (gitignored).
  Copy `android/keystore.properties.example` and fill in real values
  on the release machine. Nothing secret is committed, hardcoded, or
  printed: the Gradle config fails loudly naming only the _missing
  key_ if anything is absent — a release is never silently
  debug-signed.
- Create once (do NOT rotate without explicit reason — rotation
  orphans installed users):
  `keytool -genkeypair -v -storetype PKCS12 -keystore
myclassu-release.keystore -alias myclassu -keyalg RSA -keysize
2048 -validity 10950`
  NOTE: for PKCS12 the key password MUST equal the store password.
- Certificate fingerprint (SHA-256) is recorded in the release report;
  verify every artifact against it before distributing.

## Build commands

```sh
cd android
./gradlew assembleRelease   # APK: app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease     # AAB: app/build/outputs/bundle/release/app-release.aab
```

Release specifics: Hermes bytecode bundle embedded (no Metro needed),
R8 minification ON with keeps for `com.myclassu.**` and
kotlinx.serialization (verified by the smoke suite below),
`usesCleartextTraffic=false` (plugin default for release; debug keeps
LAN HTTP), `debuggable=false`, dev-only UI (`__DEV__`) and debug
bridge actions compiled out.

Launcher icon (Stage 12): user-supplied `Images/icon.jpeg` (2048×2048,
cream calendar + navy clock on navy `#022136`) shipped as
`mipmap-{mdpi…xxxhdpi}/ic_launcher[_foreground|_round].png` (15 files)
plus `mipmap-anydpi-v26/ic_launcher[.round].xml` adaptive icons over a
`@color/ic_launcher_background` background. The motif sits inside the
adaptive-icon safe zone, so circle/squircle masks keep calendar and
clock visible; no monochrome variant (a single-color reduction would
distort the artwork — launchers fall back to the standard icon).
Verified inside the built APK and live in the device launcher dock.
Manifest references (`@mipmap/ic_launcher`) unchanged.

## Signature verification

```sh
APK=app/build/outputs/apk/release/app-release.apk
AAB=app/build/outputs/bundle/release/app-release.aab
apksigner verify --print-certs "$APK"   # expect V2 + MyClassu cert
jarsigner -verify "$AAB"                # expect "jar verified"
aapt dump badging "$APK"                # package=com.myclassu, versionCode/versionName
aapt dump xmltree "$APK" AndroidManifest.xml  # usesCleartextTraffic=false, no debuggable
```

Record sizes + SHA-256 of both artifacts with every release. Stage 12
final: APK 83.1 MB
(`22D0040C03F2FAEA27EC13CCDBDD7B5AA42D8A24FB0FFA67707B4C7DA459948E`),
AAB 59.5 MB
(`EAB1536EA9DC1BE4D6A1B680C1D4529DD8647B58AB369CFDDC009FA9`)
(4 ABIs; Play serves per-device splits from the AAB). Both verified:
`apksigner` V2 + MyClassu cert on the APK, `jarsigner` on the AAB,
package `com.myclassu` v1/1.0, cleartext=false, not debuggable.

## Dependency / security review (Stage 12)

- `npm audit`: 22 high findings, all one advisory
  (`braces` stack-exhaustion via micromatch → metro/CLI toolchain).
  Development-only build tooling, not shipped in the app, fixable
  only via breaking upgrades — documented, not upgraded.
- Release Hermes bundle scanned for secrets: no AgentMail keys, no
  service-role/JWT material, no keystore material, no `.env` values
  (no `.env` exists; Supabase stays unconfigured until deployed).
  Two hits were library-internal identifiers, verified by context.
- Permissions kept (all verified in use): INTERNET,
  POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, SCHEDULE_EXACT_ALARM,
  VIBRATE, USE_FULL_SCREEN_INTENT. No background service added.

## Platform limitations (tell users the truth)

- Alarms need notification permission (API 33+) and exact-alarm
  access; without them delivery degrades (inexact timing or silent
  delivery) — the app reports status honestly and never crashes.
- Full-screen launch happens only when the screen is off/locked;
  with the app in use the alarm arrives as an ongoing heads-up entry.
- Android cancels ALL alarms on force-stop by design; they re-arm on
  the next app launch. Reboot recovery runs via BOOT_COMPLETED.
- No alarm delivery is promised when the user revokes permissions or
  force-stops the app.

## Production HTTPS

Release forbids cleartext traffic. Supabase (`https://…`) and
AgentMail (`https://api.agentmail.ai`) are HTTPS-only. Debug builds
keep LAN HTTP for Metro.

## Cloud/email prerequisites (all PENDING live verification)

1. Supabase project + all migrations applied + auth enabled.
2. Ship `.env` values (`SUPABASE_URL`, publishable key) via a secure
   channel — never Git.
3. `supabase functions deploy send-attendance-report` +
   `supabase secrets set AGENTMAIL_API_KEY / AGENTMAIL_FROM_ADDRESS`.
4. pg_cron schedule (`30 12 * * *` UTC = 18:00 IST) per
   `docs/REPORTING.md`.
5. No live sync or email delivery has been performed or claimed.

## Smoke-test checklist (release APK, no Metro)

Clean install → launch → Home/Schedule → add/edit/delete session →
reminder + class-start delivery → sound/vibration/dismiss → attended

- absence recording → history/analytics → force-stop relaunch
  (persistence) → offline operation → honest sync status → logcat
  clean. Then uninstall release, reinstall debug, and restore the
  device to its pre-test state.

## Upgrade notes

- Same `applicationId` + same keystore + higher `versionCode` =
  in-place upgrade preserving AsyncStorage, attendance, and alarms.
- Debug↔release certificate mismatch REQUIRES uninstall (data loss)
  — never do this to a user's daily driver without a verified backup
  and explicit approval.
