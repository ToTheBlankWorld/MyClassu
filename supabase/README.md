# Supabase

MyClassu's cloud layer. **The app is offline-first** — nothing here is on the
critical path for showing the timetable, computing the next class, or firing
alarms. Supabase provides cloud persistence, sync, and (later) server-side
report generation.

## Layout

```
supabase/
  migrations/          Plain SQL migrations, applied in filename order
  functions/
    send-attendance-report/   Daily 6 PM IST email job (Deno, service role)
    _shared/                  Pure report builders + AgentMail sender (Jest-tested)
```

## Migrations

| File                                                 | Contents                                  |
| ---------------------------------------------------- | ----------------------------------------- |
| `20261006090000_profiles.sql`                        | `profiles`, `set_updated_at()` helper     |
| `20261006090001_courses_and_class_sessions.sql`      | `courses`, `class_sessions`               |
| `20261006090002_attendance_and_skip_reasons.sql`     | `attendance_records`, `skip_reasons`      |
| `20261006090003_notification_and_email_settings.sql` | `notification_settings`, `email_settings` |
| `20261010090004_report_log.sql`                      | `report_log` delivery ledger              |

Every user-owned table has **Row Level Security** enabled with policies
scoped to `auth.uid()` — see `docs/DATABASE.md` for the full policy list and
modeling rationale.

## Applying migrations

**Option A — Supabase CLI (recommended):**

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B — Dashboard:** open _SQL Editor_ in the Supabase dashboard and run
each migration file in filename order. The files are idempotent per object
(`create table if not exists`), but applying them once in order is the
intended path.

## Secrets policy

- The mobile app uses only `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`
  (see `.env.example`). Both are safe for client-side use.
- The PostgreSQL password, service-role key, and any AgentMail API key are
  **server-only** and must never enter the repository, `.env.example`, or the
  mobile app.

## Edge Functions (report delivery)

`send-attendance-report` is invoked on a schedule (pg_cron, 12:30 UTC =
18:00 Asia/Kolkata — never from the device). Deploy:

```sh
supabase functions deploy send-attendance-report
supabase secrets set AGENTMAIL_API_KEY=<private-key> AGENTMAIL_FROM_ADDRESS=<verified-sender>
```

then schedule per `docs/REPORTING.md`. The shared builders
(`functions/_shared/`) are dependency-free and covered by Jest
(`agentmail.test.ts`, `attendance-report.test.ts`); the Deno entry
point itself is typechecked at deploy time (`deno check`).
