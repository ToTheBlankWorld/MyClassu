# MyClassu — Database

The PostgreSQL schema for the Supabase project. The schema is reproducible from the repository: plain SQL migrations in `supabase/migrations/`, applied in filename order. **Nothing here is on the app's critical path** — the local timetable and alarms work with the cloud completely offline.

## Modeling principles

1. **User-owned rows.** Every table is scoped to a `user_id` (or, for `profiles`, IS the auth user id) and protected by Row Level Security.
2. **Room belongs to the session, not the course.** `class_sessions` carries room (and per-session instructor) because the same course meets in different rooms on different days.
3. **Controlled vocabularies via CHECK constraints**, mirrored by TypeScript types in `src/services/supabase/database.types.ts`: weekday names and attendance statuses cannot be arbitrary strings.
4. **Schedule state is never stored.** `upcoming/current/completed` is derived from the clock in the app's engine. Only attendance _decisions_ are stored.
5. **One attendance record per occurrence**, enforced by `unique (class_session_id, date)`.

## Tables

### profiles

| Column                  | Type        | Notes                               |
| ----------------------- | ----------- | ----------------------------------- |
| id                      | uuid PK     | = `auth.users.id`, cascade delete   |
| email                   | text        | from auth, mirrored for convenience |
| display_name            | text        |                                     |
| timezone                | text        | default `'Asia/Kolkata'`            |
| created_at / updated_at | timestamptz | auto                                |

### courses

| Column     | Type          | Notes                                      |
| ---------- | ------------- | ------------------------------------------ |
| id         | uuid PK       | `gen_random_uuid()`                        |
| user_id    | uuid NOT NULL | FK `auth.users`, cascade                   |
| code       | text NOT NULL | unique per user (`unique (user_id, code)`) |
| title      | text NOT NULL |                                            |
| instructor | text          | default instructor; sessions may override  |

### class_sessions

| Column                | Type          | Notes                                                |
| --------------------- | ------------- | ---------------------------------------------------- |
| id                    | uuid PK       |                                                      |
| user_id               | uuid NOT NULL | FK, cascade                                          |
| course_id             | uuid NOT NULL | FK `courses`, cascade                                |
| weekday               | text NOT NULL | CHECK: `monday … sunday`                             |
| start_time / end_time | time NOT NULL | local university time; CHECK `end_time > start_time` |
| room                  | text          | e.g. `ICT / 305` — per-session truth                 |

### attendance*records *(schema foundation; UI comes later)\_

| Column                        | Type          | Notes                                                  |
| ----------------------------- | ------------- | ------------------------------------------------------ |
| id                            | uuid PK       |                                                        |
| user_id                       | uuid NOT NULL | FK, cascade                                            |
| class_session_id              | uuid NOT NULL | FK `class_sessions`, cascade                           |
| date                          | date NOT NULL | local calendar date; `unique (class_session_id, date)` |
| status                        | text NOT NULL | CHECK: `attended / skipped / pending / unconfirmed`    |
| reason_category / reason_text | text          | structured skip reason + optional note                 |
| marked_at                     | timestamptz   | when the user decided                                  |

Attendance status is **independent of schedule status**: a class that is over (schedule: completed) may still be `unconfirmed`; `pending`/`unconfirmed` let the app distinguish "not decided yet" from "decided, didn't attend, reason given".

### skip_reasons

| Column  | Type          | Notes                                                 |
| ------- | ------------- | ----------------------------------------------------- |
| id      | uuid PK       |                                                       |
| user_id | uuid NULL     | `null` = shared default reason; set = personal reason |
| name    | text NOT NULL |                                                       |
| icon    | text          |                                                       |

Planned default vocabulary: entertainment, study, work, personal, health, overslept, other.

### notification_settings

`user_id` PK (FK, cascade) · `reminder_minutes` int default **5** (CHECK 0–120) · `alarm_enabled` bool default true · `sound_enabled` bool default true · `haptics_enabled` bool default true.

### email_settings

`user_id` PK (FK, cascade) · `enabled` bool default false · `report_time` time default **`18:00`** · `email_address` text.

## Relationships

```
auth.users 1─1 profiles
auth.users 1─n courses 1─n class_sessions 1─n attendance_records
auth.users 1─n skip_reasons          (user_id nullable → shared defaults)
auth.users 1─1 notification_settings
auth.users 1─1 email_settings
```

## Row Level Security

RLS is **enabled on every user-owned table**. Policies are always scoped to the authenticated user via `auth.uid()`; there are no `USING (true)` catch-alls.

| Table                 | SELECT / INSERT / UPDATE / DELETE                                                  |
| --------------------- | ---------------------------------------------------------------------------------- |
| profiles              | `auth.uid() = id`                                                                  |
| courses               | `auth.uid() = user_id`                                                             |
| class_sessions        | `auth.uid() = user_id`                                                             |
| attendance_records    | `auth.uid() = user_id`                                                             |
| skip_reasons          | SELECT: shared defaults (`user_id IS NULL`) **or** own rows; writes: own rows only |
| notification_settings | `auth.uid() = user_id`                                                             |
| email_settings        | `auth.uid() = user_id`                                                             |

INSERT/UPDATE policies use `WITH CHECK` so a user can never create or move a row into another user's namespace. Deletes cascade from `auth.users`.

`updated_at` is maintained by a shared `set_updated_at()` trigger function created in the first migration.

## Migration process

```sh
# Option A — Supabase CLI
supabase link --project-ref <ref>
supabase db push

# Option B — Dashboard → SQL Editor → run files in filename order
```

Files are ordered by embedded timestamp (`20261006090000_profiles.sql`, …). Structural invariants (table set, CHECK vocabularies, RLS coverage, no permissive policies) are pinned by `supabase/migrations/migrations.test.ts` — run with `npm test`.

## Type generation

`src/services/supabase/database.types.ts` mirrors this schema by hand. When the schema changes, update the migrations **and** the types in the same commit (the structural tests catch drift of the table set; keep column-level changes in sync manually, or regenerate with `supabase gen types` when the CLI is available).
