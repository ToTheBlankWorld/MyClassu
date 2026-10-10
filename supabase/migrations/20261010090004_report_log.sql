-- MyClassu migration 0005 — report_log (email report idempotency ledger)
--
-- Server-side scheduled reports (Stage 10) must never send duplicates:
-- one row per (user, report date, kind), guarded by a unique key. The
-- sending job inserts the row BEFORE calling the email provider; a retry
-- then hits the unique constraint instead of the inbox.
-- Delivery itself is provider-confirmed: a row is marked 'sent' only after
-- AgentMail confirms acceptance.

create table if not exists public.report_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_date date not null,
  kind text not null check (kind in ('daily', 'weekly')),
  idempotency_key text not null,
  status text not null check (status in ('sending', 'sent', 'failed')) default 'sending',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, report_date, kind),
  unique (idempotency_key)
);

comment on table public.report_log is
  'Email report delivery ledger. Unique per (user, date, kind) plus a global idempotency key (daily:<user>:<date>); rows start as sending and only move to sent after the provider confirms.';

create index report_log_user_date_idx on public.report_log (user_id, report_date);

alter table public.report_log enable row level security;

create policy "report_log_select_own"
  on public.report_log for select
  using (auth.uid() = user_id);

create trigger report_log_set_updated_at
  before update on public.report_log
  for each row execute function public.set_updated_at();
