-- Meridian — notifications + onboarding schema (platform-wide, not a module).
-- Run this whole file once in the Supabase SQL editor, after the six module
-- schemas. Same auth.uid()-scoped RLS pattern as every other file here.
--
-- Four tables, and they divide along one line: the first three are read by the
-- SERVER (the push-dispatch Edge Function, running on a cron with the service
-- role key), the fourth is read only by the client. That is why the notification
-- tables carry a timezone and a send log at all — a cron job has no idea what
-- "6pm your time" means unless the row tells it.

-- ============================================================================
-- 1. meridian_push_subscriptions
-- One row per browser/install the user has enabled notifications on — a phone
-- home-screen PWA and a desktop Chrome are two separate subscriptions, and both
-- should ring. The endpoint is the primary key because it IS the identity of a
-- push subscription: re-subscribing the same browser returns the same endpoint,
-- so an upsert on it can never accumulate duplicates.
--
-- p256dh + auth are the client's public key material for RFC 8291 payload
-- encryption. They are not secrets in the usual sense (they only let someone
-- push TO this browser, and only with the matching VAPID private key), but RLS
-- scopes them to the owner anyway, like everything else here.
-- ============================================================================
create table meridian_push_subscriptions (
  endpoint text primary key,
  user_id uuid references auth.users not null,
  p256dh text not null,
  auth text not null,
  -- Purely so the settings screen can say "this device" rather than "endpoint 3".
  user_agent text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

create index meridian_push_subs_user_idx on meridian_push_subscriptions (user_id);

-- ============================================================================
-- 2. meridian_notification_settings
-- One row per user. The master switch and the per-module switches are separate
-- columns rather than a jsonb blob so the dispatcher can filter in SQL, and so
-- adding a seventh module is a migration rather than a silent shape change.
--
-- Aurum is deliberately absent: it has no notifications at all, by design.
--
-- `timezone` is the load-bearing column. Every trigger in this system is stated
-- in the user's LOCAL time ("every hour on the hour", "6pm", "30 minutes before
-- class"), and the dispatcher runs in UTC on a server that has never met them.
-- The client writes its IANA zone here on every launch, so moving between zones
-- corrects itself the next time the app is opened.
-- ============================================================================
create table meridian_notification_settings (
  user_id uuid primary key references auth.users,
  enabled boolean not null default true,
  kindle_water boolean not null default true,
  vigil_study boolean not null default true,
  loom_classes boolean not null default true,
  virtus_gym boolean not null default true,
  chronicle_todos boolean not null default true,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 3. meridian_notification_log
-- The idempotency key for the whole system, and the reason the cron can run
-- every minute without ever sending the same nudge twice.
--
-- Each notification the dispatcher considers sending derives a `dedupe_key` from
-- the user's LOCAL clock — Kindle's water reminder is "2026-09-03:14", Virtus's
-- gym check is just "2026-09-03", a Loom class is "2026-09-03:<slot_id>". The
-- unique constraint below is what enforces once-and-only-once: the dispatcher
-- inserts FIRST and only sends when the insert actually created a row, so two
-- overlapping cron invocations cannot both win.
--
-- Rows older than a few days are worthless; see the prune function at the bottom.
-- ============================================================================
create table meridian_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  kind text not null check (
    kind in ('kindle_water', 'vigil_study', 'loom_class', 'virtus_gym', 'chronicle_todos', 'test')
  ),
  dedupe_key text not null,
  sent_at timestamptz default now(),
  unique (user_id, kind, dedupe_key)
);

create index meridian_notification_log_sent_idx on meridian_notification_log (sent_at);

-- ============================================================================
-- 4. meridian_walkthroughs
-- Which onboarding walkthroughs this user has finished or skipped. Keyed by
-- module rather than being one "onboarded" flag, because the modules are entered
-- independently — someone can use Kindle for a month before first opening
-- Virtus, and should still get Virtus's introduction at that point.
--
-- 'skipped' is stored distinctly from 'completed' rather than collapsed into one
-- boolean: both stop the walkthrough re-triggering, but only one of them means
-- the user actually saw it, and the settings screen says which.
-- ============================================================================
create table meridian_walkthroughs (
  user_id uuid references auth.users not null,
  module_key text not null check (
    module_key in ('meridian', 'aurum', 'kindle', 'vigil', 'loom', 'virtus', 'chronicle')
  ),
  status text not null check (status in ('completed', 'skipped')),
  updated_at timestamptz default now(),
  primary key (user_id, module_key)
);

-- ============================================================================
-- Row Level Security — every table user_id-scoped, no exceptions, same as every
-- other schema file in this repo.
--
-- The push-dispatch Edge Function reads these tables ACROSS all users, which no
-- anon-key client can do. It uses the service role key for exactly that reason,
-- and it is the only thing in this project that does — see the header comment in
-- supabase/functions/push-dispatch/index.ts for why that is unavoidable here.
-- ============================================================================
alter table meridian_push_subscriptions enable row level security;
create policy "Users manage own push subscriptions" on meridian_push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table meridian_notification_settings enable row level security;
create policy "Users manage own notification settings" on meridian_notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table meridian_notification_log enable row level security;
create policy "Users read own notification log" on meridian_notification_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table meridian_walkthroughs enable row level security;
create policy "Users manage own walkthroughs" on meridian_walkthroughs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- Log cleanup. The log exists only to make sends idempotent within the day it
-- covers, so anything older than a week is dead weight. Wired to pg_cron in
-- supabase/notifications_cron.sql; running it by hand is harmless.
-- ============================================================================
create or replace function public.meridian_prune_notification_log()
returns void
language sql
security definer
set search_path = public
as $prune$
  delete from meridian_notification_log where sent_at < now() - interval '7 days';
$prune$;
