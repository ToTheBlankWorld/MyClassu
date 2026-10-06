-- MyClassu · migration 0004 — notification_settings + email_settings
--
-- Schema foundation only; wiring these into native alarms (AlarmManager) and
-- the AgentMail report sender are later stages. Defaults reflect the product
-- decisions: 5-minute class reminder, daily report at 18:00 Asia/Kolkata.

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reminder_minutes int not null default 5 check (reminder_minutes between 0 and 120),
  alarm_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  haptics_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_settings is
  'Per-user reminder/alarm preferences consumed by the native alarm scheduler.';

create table if not exists public.email_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  report_time time not null default '18:00',
  email_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.email_settings is
  'Per-user daily report preferences; the report itself is sent by a server-side job (AgentMail) in a later stage.';

alter table public.notification_settings enable row level security;
alter table public.email_settings enable row level security;

create policy "notification_settings_all_own"
  on public.notification_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "email_settings_all_own"
  on public.email_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger notification_settings_set_updated_at
  before update on public.notification_settings
  for each row execute function public.set_updated_at();

create trigger email_settings_set_updated_at
  before update on public.email_settings
  for each row execute function public.set_updated_at();
