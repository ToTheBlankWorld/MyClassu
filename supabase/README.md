# Supabase

MyClassu's cloud layer. **The app is offline-first** — nothing here is on the
critical path for showing the timetable, computing the next class, or firing
alarms. Supabase provides cloud persistence, sync, and (later) server-side
report generation.

## Layout

```
supabase/
  migrations/          Plain SQL migrations, applied in filename order
```

## Migrations

| File                                                 | Contents                                  |
| ---------------------------------------------------- | ----------------------------------------- |
| `20261006090000_profiles.sql`                        | `profiles`, `set_updated_at()` helper     |
| `20261006090001_courses_and_class_sessions.sql`      | `courses`, `class_sessions`               |
| `20261006090002_attendance_and_skip_reasons.sql`     | `attendance_records`, `skip_reasons`      |
| `20261006090003_notification_and_email_settings.sql` | `notification_settings`, `email_settings` |

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
