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
