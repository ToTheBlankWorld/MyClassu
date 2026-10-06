-- MyClassu · migration 0003 — attendance_records + skip_reasons
--
-- Schema foundation only; the attendance UI/flows come in a later stage.
--
-- Attendance state is deliberately SEPARATE from schedule state:
--   * schedule state (upcoming / current / completed) is derived from the
--     clock and lives in the app's timetable engine — it is never stored;
--   * attendance state is a USER DECISION about a concrete occurrence
--     (class_session_id + local calendar date), stored here.
-- A class can be completed on the schedule while its attendance is still
-- 'unconfirmed' — the two lifecycles are independent by design.
--
-- One record per occurrence: unique (class_session_id, date).
-- Status values mirror the TypeScript domain model (lowercase).

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_session_id uuid not null references public.class_sessions (id) on delete cascade,
  date date not null,
  status text not null check (status in (
    'attended', 'skipped', 'pending', 'unconfirmed'
  )),
  reason_category text,
  reason_text text,
  marked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_session_id, date)
);

comment on table public.attendance_records is
  'The user attendance decision for one concrete class occurrence (session × local date).';

create index attendance_records_user_date_idx on public.attendance_records (user_id, date);

create table if not exists public.skip_reasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamptz not null default now()
);

comment on table public.skip_reasons is
  'Skip reason vocabulary. Rows with user_id = null are shared defaults (entertainment, study, work, personal, health, overslept, other); user rows are personal additions.';

alter table public.attendance_records enable row level security;
alter table public.skip_reasons enable row level security;

create policy "attendance_records_all_own"
  on public.attendance_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Shared default reasons (user_id is null) are readable by every
-- authenticated user; personal reasons are fully private.
create policy "skip_reasons_select"
  on public.skip_reasons for select
  using (user_id is null or user_id = auth.uid());

create policy "skip_reasons_insert_own"
  on public.skip_reasons for insert
  with check (user_id = auth.uid());

create policy "skip_reasons_update_own"
  on public.skip_reasons for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "skip_reasons_delete_own"
  on public.skip_reasons for delete
  using (user_id = auth.uid());

create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();
