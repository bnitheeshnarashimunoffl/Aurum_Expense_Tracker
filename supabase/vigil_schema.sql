-- Vigil — Supabase schema (third Meridian module, alongside Aurum and Kindle)
-- Run this whole file once in the Supabase SQL editor. Independent of the other
-- modules' tables — no foreign keys cross module boundaries. Same auth.uid()-scoped
-- RLS pattern as supabase/schema.sql and supabase/kindle_schema.sql.
--
-- No seed data: every category/subject/subtopic is user-created from the tree UI,
-- and a day row is created lazily the first time the timer runs on that date.

-- ============================================================================
-- 1. vigil_days
-- One row per (user, date). "accumulated_seconds" is the study time already
-- banked by completed play/pause segments. "running_since" is non-null only
-- while the timer is actively counting; live studied time is always
--     accumulated_seconds + (now() - running_since)
-- which is why closing the app mid-session loses nothing.
--
-- Everything else is DERIVED, never stored: remaining = 18000 - studied,
-- overflow = studied - 18000, "in overflow" = studied > 18000. Same principle as
-- Kindle deriving completion from `stage` rather than storing a second flag.
-- ============================================================================
create table vigil_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  accumulated_seconds int not null default 0 check (accumulated_seconds >= 0),
  running_since timestamptz,
  edited_after_the_fact boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

create index vigil_days_user_date_idx on vigil_days (user_id, date);

-- ============================================================================
-- 2. Topic tree — vigil_categories > vigil_subjects > vigil_subtopics
-- `completed` exists ONLY on subtopics. A subject's and a category's
-- complete/partial/empty state is always derived from the subtopics beneath it
-- (src/vigil/lib/tree.ts), so the upward cascade can never disagree with the
-- leaves and there is no second source of truth to keep in sync.
-- ============================================================================
create table vigil_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  label text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table vigil_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references vigil_categories(id) on delete cascade not null,
  label text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table vigil_subtopics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  subject_id uuid references vigil_subjects(id) on delete cascade not null,
  label text not null,
  position int not null default 0,
  completed boolean not null default false,
  created_at timestamptz default now()
);

create index vigil_subjects_category_idx on vigil_subjects (category_id);
create index vigil_subtopics_subject_idx on vigil_subtopics (subject_id);

-- ============================================================================
-- 3. vigil_pin
-- Gates past-day timer edits in Settings only — the topic tree is deliberately
-- ungated. Same salted-SHA-256 storage as kindle_pin (shared code in
-- src/lib/pin.ts); a separate row so each module's PIN can differ if wanted.
-- ============================================================================
create table vigil_pin (
  user_id uuid primary key references auth.users,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- Row Level Security — every table user_id-scoped, no exceptions.
-- ============================================================================
alter table vigil_days enable row level security;
create policy "Users manage own vigil days" on vigil_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table vigil_categories enable row level security;
create policy "Users manage own vigil categories" on vigil_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table vigil_subjects enable row level security;
create policy "Users manage own vigil subjects" on vigil_subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table vigil_subtopics enable row level security;
create policy "Users manage own vigil subtopics" on vigil_subtopics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table vigil_pin enable row level security;
create policy "Users manage own vigil pin" on vigil_pin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- vigil_targets
-- The daily study target, per week. One row per (user, Monday).
--
-- Not five hours for everybody, and not a single mutable setting either. The
-- target is chosen for a week and then held for that week, because a target you
-- can lower at 9pm on a bad Thursday is not a target, it is a mood. Deciding once
-- and living with it for seven days is the entire point of the feature.
--
-- THE LOCK IS THIS TABLE'S SHAPE, NOT THE UI'S GOOD MANNERS. There is a SELECT
-- policy and an INSERT policy below and deliberately NO update and NO delete, so
-- a row is immutable the moment it exists — the primary key on (user_id,
-- week_start) is what refuses the second attempt. Nothing client-side is trusted
-- to enforce it, and no server-side "is it still this week?" arithmetic is needed
-- (which would have had to reason about the user's timezone against the
-- database's, and been wrong for somebody every Monday morning).
--
-- No row for a week means no choice was made for it, and the app falls back to
-- the five-hour default. That is what lets a brand-new account pick a target on a
-- Wednesday rather than being held at five hours until the following Monday.
-- Past weeks keep the target they were actually judged against, so a chart of
-- March does not get re-scored against a decision made in April.
-- ============================================================================
create table if not exists vigil_targets (
  user_id uuid references auth.users not null,
  week_start date not null,
  -- 30 minutes to 12 hours. The floor stops the target being set to something
  -- that is met by opening the app; the ceiling is past any honest study day.
  target_seconds int not null check (target_seconds between 1800 and 43200),
  created_at timestamptz default now(),
  primary key (user_id, week_start)
);

alter table vigil_targets enable row level security;
drop policy if exists "Users read own vigil targets" on vigil_targets;
create policy "Users read own vigil targets" on vigil_targets
  for select using (auth.uid() = user_id);
-- Insert only. See the note above: the absence of an update policy IS the lock.
drop policy if exists "Users set own vigil target once" on vigil_targets;
create policy "Users set own vigil target once" on vigil_targets
  for insert with check (auth.uid() = user_id);
