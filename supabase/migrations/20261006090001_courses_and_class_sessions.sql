-- MyClassu · migration 0002 — courses + class_sessions
--
-- The timetable. Modeling rule (mirrors the local domain model):
-- the ROOM and INSTRUCTOR of a meeting live on class_sessions, NOT on
-- courses — the same course legitimately meets in different rooms on
-- different days (e.g. 24CSEN4121 → ICT/305 Monday, ICT/118 Tuesday).
--
-- weekday is constrained to a fixed set of lowercase day names; times are
-- PostgreSQL TIME values in the user's local university timezone
-- (Asia/Kolkata by default, stored per-profile).

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  title text not null,
  instructor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

comment on table public.courses is
  'Stable course identity (code/title/default instructor). Per-meeting details live on class_sessions.';

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  weekday text not null check (weekday in (
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  )),
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

comment on table public.class_sessions is
  'One recurring weekly meeting slot of a course. room/instructor are per-session truth and may differ between sessions of the same course.';

create index courses_user_id_idx on public.courses (user_id);
create index class_sessions_user_weekday_idx on public.class_sessions (user_id, weekday);
create index class_sessions_course_id_idx on public.class_sessions (course_id);

alter table public.courses enable row level security;
alter table public.class_sessions enable row level security;

create policy "courses_all_own"
  on public.courses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "class_sessions_all_own"
  on public.class_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create trigger class_sessions_set_updated_at
  before update on public.class_sessions
  for each row execute function public.set_updated_at();
