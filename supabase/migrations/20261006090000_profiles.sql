-- MyClassu · migration 0001 — profiles
--
-- One profile row per authenticated Supabase user. The profile id IS the
-- auth user id. New users are expected to create their profile row right
-- after sign-up (or via a future database trigger/auth hook).

create extension if not exists pgcrypto;

-- Shared helper: keeps updated_at current on every modification.
-- (Created once here; later migrations attach it to their tables.)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'User profile; id matches the Supabase auth user. Default timezone Asia/Kolkata.';

alter table public.profiles enable row level security;

-- RLS: a user may only see and manage their own profile. No permissive
-- catch-all policies exist for user data.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
