-- Virtus — Supabase schema (fifth Meridian module, alongside Aurum, Kindle,
-- Vigil and Loom). Run this whole file once in the Supabase SQL editor.
-- Independent of the other modules' tables — no foreign keys cross module
-- boundaries. Same auth.uid()-scoped RLS pattern as supabase/schema.sql,
-- kindle_schema.sql, vigil_schema.sql and loom_schema.sql.
--
-- No seed data: every muscle group, exercise, split day and schedule entry is
-- user-created. A session row is created lazily, the first time a set is logged
-- on that date (or the day is marked as rest).

-- ============================================================================
-- 1. virtus_muscle_groups
-- A user-editable category list, deliberately NOT a hardcoded enum — the brief
-- requires new groups to be creatable, and an enum would need a migration for
-- each one.
-- ============================================================================
create table virtus_muscle_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  label text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create index virtus_muscle_groups_user_idx on virtus_muscle_groups (user_id, position);

-- ============================================================================
-- 2. virtus_exercises
-- The library, and the source of truth for what can be assigned into a split day.
--
-- `archived` is a SOFT delete, and it is the whole reason logged history survives:
-- a set references its exercise by id forever, so hard-deleting "Lat Pulldown"
-- would silently strip it out of every past workout. Deleting from the library
-- therefore sets archived = true and unassigns it from split days, while every
-- historical set keeps resolving its name. Same principle as Kindle's soft-deleted
-- habits.
--
-- muscle_group_id is nullable and ON DELETE SET NULL: removing a category should
-- orphan its exercises into "Uncategorised", never delete them.
-- ============================================================================
create table virtus_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  muscle_group_id uuid references virtus_muscle_groups(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz default now()
);

create index virtus_exercises_user_idx on virtus_exercises (user_id, archived);

-- ============================================================================
-- 3. virtus_split_days  +  virtus_split_day_exercises
-- Workout day templates, built from the library — the same "reference a preset by
-- id, never copy it" pattern as Loom's class presets. Renaming an exercise updates
-- it in every split day that uses it, because there is only ever one copy.
-- ============================================================================
create table virtus_split_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table virtus_split_day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  split_day_id uuid references virtus_split_days(id) on delete cascade not null,
  exercise_id uuid references virtus_exercises(id) on delete cascade not null,
  position int not null default 0,
  unique (split_day_id, exercise_id)
);

create index virtus_sde_split_day_idx on virtus_split_day_exercises (split_day_id, position);

-- ============================================================================
-- 4. virtus_schedule
-- Maps each weekday to a split day, or to Rest. day_of_week is 0 = Monday .. 6 =
-- Sunday, matching the Mon-first week the rest of Meridian uses (see lib/date.ts).
-- A NULL split_day_id means Rest; a missing row means "not scheduled yet", which
-- the UI shows as unset rather than silently as rest.
--
-- This drives the suggestion on Home only. It is never written back into history,
-- so editing the schedule cannot rewrite what was already logged.
-- ============================================================================
create table virtus_schedule (
  user_id uuid references auth.users not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  split_day_id uuid references virtus_split_days(id) on delete set null,
  primary key (user_id, day_of_week)
);

-- ============================================================================
-- 5. virtus_sessions  +  virtus_sets
-- One session per (user, date) — a training day or an explicitly logged rest day.
-- Rest is a real record, not the absence of one, so "I rested" and "I forgot to
-- log" stay distinguishable in the grid.
--
-- total_volume is NOT stored. It is Σ(weight_kg × reps) over the session's sets,
-- derived on read (src/virtus/lib/volume.ts) — storing it would introduce a second
-- source of truth that could disagree with the sets after any edit. Same rule as
-- Vigil deriving overflow and Kindle deriving completion.
-- ============================================================================
create table virtus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  split_day_id uuid references virtus_split_days(id) on delete set null,
  is_rest_day boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date),
  -- A rest day has no split day, and a training day must name one.
  constraint virtus_session_shape check (
    (is_rest_day and split_day_id is null) or (not is_rest_day and split_day_id is not null)
  )
);

create index virtus_sessions_user_date_idx on virtus_sessions (user_id, date);

create table virtus_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  session_id uuid references virtus_sessions(id) on delete cascade not null,
  -- ON DELETE RESTRICT is the database-level backstop for the soft-delete rule
  -- above: even a stray hard delete cannot take logged history with it.
  exercise_id uuid references virtus_exercises(id) on delete restrict not null,
  set_number int not null check (set_number >= 1),
  weight_kg numeric(6, 2) not null check (weight_kg >= 0),
  reps int not null check (reps >= 0),
  logged_at timestamptz default now()
);

create index virtus_sets_session_idx on virtus_sets (session_id);
create index virtus_sets_exercise_idx on virtus_sets (exercise_id);

-- ============================================================================
-- 6. virtus_pin
-- Gates edits to sessions before today. Same salted-SHA-256 storage as kindle_pin
-- and vigil_pin (shared code in src/lib/pin.ts and src/hooks/usePinTable.ts); a
-- separate row per module, so each module's PIN can differ.
-- ============================================================================
create table virtus_pin (
  user_id uuid primary key references auth.users,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- Row Level Security — every table user_id-scoped, no exceptions.
-- ============================================================================
alter table virtus_muscle_groups enable row level security;
create policy "Users manage own virtus muscle groups" on virtus_muscle_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_exercises enable row level security;
create policy "Users manage own virtus exercises" on virtus_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_split_days enable row level security;
create policy "Users manage own virtus split days" on virtus_split_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_split_day_exercises enable row level security;
create policy "Users manage own virtus split day exercises" on virtus_split_day_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_schedule enable row level security;
create policy "Users manage own virtus schedule" on virtus_schedule
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_sessions enable row level security;
create policy "Users manage own virtus sessions" on virtus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_sets enable row level security;
create policy "Users manage own virtus sets" on virtus_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_pin enable row level security;
create policy "Users manage own virtus pin" on virtus_pin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
