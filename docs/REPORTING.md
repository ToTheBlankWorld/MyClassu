# MyClassu — Cloud Sync & Attendance Email Reports

Local-first always: the timetable, alarms, attendance capture, and
analytics work fully offline. This document covers what happens when a
Supabase project and sign-in exist on top of that foundation.

## Session UUID mapping

Local timetable IDs are stable strings (`session-…`, `course-…`,
`session-custom-…`); server rows use uuid primary keys. The mapping
(`myclassu.sessionMapping.v1` / `myclassu.courseMapping.v1`) is written
only after the server confirms the row — never guessed, never invented.

- Courses upsert on the unique `(user_id, code)` key; the returned uuid
  is stored against the local course ID.
- Mapped sessions update by uuid; unmapped sessions insert once, then
  update forever after. Repeated syncs converge (verified by test).
- Locally deleted sessions keep their server rows (history safety);
  only the stale local mapping is pruned.
- Attendance uploads resolve the server uuid through this map. Records
  without a mapping defer as `unmapped` — no FK violation is ever
  attempted.

## Attendance outbox

`syncPendingAttendance`: local records first (always), then per-record
upsert on the established unique key `(class_session_id, date)`.
Successes are marked synced; failures stay queued with the error kept
for the next run. No tight retry loops — sync runs on app start (and
after timetable edits that change mappings).

## Email reports

- Daily report at **18:00 Asia/Kolkata** (= **12:30 UTC**; cron
  `30 12 * * *`, see deployment below). Contents: date, scheduled
  classes with decided/undecided states, attended/missed counts,
  percentage over decided classes only, absence reasons, week-to-date.
  Undecided classes are listed, never counted as missed. Empty days get
  a concise no-classes report (or silence, per preference).
- Weekly report (Monday–Sunday): decided counts, percentage, subjects,
  reasons, previous-week comparison only with sufficient data on both
  sides. Zero records and 0% are described differently.
- Idempotency: `daily:<userId>:<dateKey>` / `weekly:<userId>:<weekStart>`,
  enforced by the `report_log` unique constraints. The sending job
  inserts `sending` BEFORE calling the provider and flips to `sent` only
  on provider confirmation.
- Preferences (Settings → Email reports, synced to `email_settings` when
  authed): daily/weekly toggles, validated recipient, empty-day choice.
  Nothing is ever sent from the device.

## AgentMail (server-side only)

Delivery goes through AgentMail's HTTPS API from the Edge Function.
The sender primitive lives in `supabase/functions/_shared/agentmail.ts`
(injected-fetch design, Jest-covered success / network-fault /
provider-rejection paths); `send-attendance-report/index.ts` is a thin
Deno wrapper around it plus the shared report builders.
Required secrets (Supabase Edge Function secrets — never in the app,
never in `.env`, never in Git):

- `AGENTMAIL_API_KEY` — private API key.
- `AGENTMAIL_FROM_ADDRESS` — verified sender.

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are Supabase-provided.
Provider errors (network, 4xx/5xx, invalid recipient) mark the ledger
row `failed` with the message; the next scheduled run retries dates
that never reached `sent`.

## Deployment prerequisites (live delivery)

1. Supabase project with all migrations applied (`report_log` included).
2. `pg_cron` + `pg_net` extensions enabled.
3. Edge Function `send-attendance-report` deployed with the two
   AgentMail secrets set.
4. Cron job (UTC — pg_cron evaluates in the database timezone, UTC on
   Supabase):
   `select cron.schedule('myclassu-daily-report', '30 12 * * *',
$$select net.http_post(...)$$)` targeting the function URL with the
   service-role key in the Authorization header.
5. At least one user with `email_settings.enabled` and an `email_address`.

## Honest limitations (current status)

- No Supabase project is configured in this repo (no `.env`), and no
  user session exists on-device: sync defers, reports stay local-only,
  Settings says exactly that. No delivery has been (or can be) faked.
- The Edge Function is implemented and its pure logic is unit-tested,
  but it has not been deployed or executed against a live project
  (no Deno/Supabase CLI in this environment).
- Weekly delivery cadence is intentionally undecided in code (the
  builder exists and is tested); wire a second cron line only when a
  weekly send day is chosen.
