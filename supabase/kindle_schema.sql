-- Kindle — Supabase schema (second Meridian module, alongside Aurum)
-- Run this whole file once in the Supabase SQL editor. Independent of Aurum's
-- tables — no foreign keys cross module boundaries. Same auth.uid()-scoped RLS
-- pattern as supabase/schema.sql.
--
-- No seed trigger here (unlike Aurum's on_auth_user_created for categories):
-- the account already existed before Kindle did, so a signup trigger would never
-- fire for it. The app seeds the 8 default habits itself, client-side, the first
-- time it sees zero rows in kindle_habits (src/kindle/lib/seed.ts) — this covers
-- both the existing account and any future signups identically.

-- ============================================================================
-- 1. kindle_habits
-- type/max_stage/target_value/target_unit/palette_key drive the multi-stage
-- progress-pill system (src/kindle/lib/gradient.ts) — binary habits are
-- max_stage=1 (a single tap goes straight to done), multi-stage habits go from
-- 1..max_stage. palette_key pins an exact non-generated palette (only 'baths'
-- today); leave it null to use the live-generated red->green gradient.
-- ============================================================================
create table kindle_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  label text not null,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  type text not null default 'binary' check (type in ('binary', 'multi_stage')),
  max_stage int not null default 1 check (max_stage between 1 and 10),
  target_value numeric,
  target_unit text,
  palette_key text
);

-- ============================================================================
-- 2. kindle_habit_logs
-- One row per (habit, date). "stage" is 0 (not started) up to that habit's
-- max_stage — "completed for the day" is always derived as stage = max_stage,
-- never stored as a separate flag. "edited_after_the_fact" + "edit_reason" are
-- only ever set by the PIN-gated past-day edit flow.
-- ============================================================================
create table kindle_habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  habit_id uuid references kindle_habits(id) not null,
  date date not null,
  stage int not null default 0,
  edited_after_the_fact boolean not null default false,
  edit_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (habit_id, date)
);

-- ============================================================================
-- 3. kindle_pin
-- One row per user. Stores a salted SHA-256 hash, never the raw PIN. A 4-digit
-- PIN only has 10,000 possible values, so treat this as UI friction against
-- accidental past-day edits, not as a real security boundary — auth + RLS below
-- are what actually protect the data.
-- ============================================================================
create table kindle_pin (
  user_id uuid primary key references auth.users,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- Row Level Security — same pattern as Aurum: every table user_id-scoped, no
-- exceptions, so a leaked anon key can't expose one user's data to anyone else.
-- ============================================================================
alter table kindle_habits enable row level security;
create policy "Users manage own kindle habits" on kindle_habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table kindle_habit_logs enable row level security;
create policy "Users manage own kindle habit logs" on kindle_habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table kindle_pin enable row level security;
create policy "Users manage own kindle pin" on kindle_pin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
