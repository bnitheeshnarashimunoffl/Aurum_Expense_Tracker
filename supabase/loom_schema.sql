-- Loom — Supabase schema (fourth Meridian module)
-- Run this whole file once in the Supabase SQL editor.
--
-- IMPORTANT, and different from the other three modules: Supabase is NOT the
-- source of truth for Loom. IndexedDB is (src/loom/lib/db.ts). These tables are a
-- background backup/sync mirror, so the app keeps working with no network at all.
-- Sync is last-write-wins on `updated_at`, single-user scope — see lib/sync.ts.
--
-- Consequences of that, visible in the shape below:
--   * ids are text, generated client-side (crypto.randomUUID) while possibly
--     offline — never a server-side default.
--   * `updated_at` is a plain timestamptz the CLIENT sets, because it is the
--     comparison key for last-write-wins. Do NOT add a trigger that overwrites it
--     on write; that would make every pull look newer than local.
--   * `deleted` is a soft-delete flag rather than a DELETE, so a removal made on
--     one device still propagates to the other.

-- ============================================================================
-- 1. loom_terms — one semester. Exactly one row per user has is_active = true.
-- ============================================================================
create table loom_terms (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  archived boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null
);

-- ============================================================================
-- 2. loom_class_presets — the reusable class library, scoped to one term.
-- Slots reference a preset BY ID, never by copy, so editing a preset changes
-- every place it is scheduled.
-- ============================================================================
create table loom_class_presets (
  id text primary key,
  user_id uuid references auth.users not null,
  term_id text not null,
  title text not null,
  location text,
  faculty_name text,
  color text not null,
  deleted boolean not null default false,
  updated_at timestamptz not null
);

-- ============================================================================
-- 3. loom_time_slots — user-defined per term, never hardcoded. Slot structure
-- can differ completely from one semester to the next.
-- ============================================================================
create table loom_time_slots (
  id text primary key,
  user_id uuid references auth.users not null,
  term_id text not null,
  position int not null default 0,
  start_time text not null, -- "09:00", local wall-clock, no timezone
  end_time text not null,
  deleted boolean not null default false,
  updated_at timestamptz not null
);

-- ============================================================================
-- 4. loom_schedule_blocks — a configuration that takes effect on a date and
-- runs until the next block's effective_from (or the term's end).
--
-- `assignments` is the day-by-day slot map, embedded as jsonb rather than kept
-- in a separate row-per-cell table:
--     { "0": { "<slot_id>": "<preset_id>" }, ... "5": { ... } }   0=Mon .. 5=Sat
-- One row per block keeps last-write-wins coherent (a block is the unit a user
-- edits and the unit that syncs), which a row-per-cell table would fragment for
-- no benefit at this scale. Saturday (5) is just another key — the "copy a
-- weekday into Saturday" action writes a snapshot into it once and never links
-- the two afterwards.
-- ============================================================================
create table loom_schedule_blocks (
  id text primary key,
  user_id uuid references auth.users not null,
  term_id text not null,
  label text,
  effective_from date not null,
  assignments jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null
);

create index loom_presets_term_idx on loom_class_presets (user_id, term_id);
create index loom_slots_term_idx on loom_time_slots (user_id, term_id);
create index loom_blocks_term_idx on loom_schedule_blocks (user_id, term_id);
create index loom_terms_updated_idx on loom_terms (user_id, updated_at);

-- ============================================================================
-- Row Level Security — every table user_id-scoped, same pattern as the other
-- three modules.
-- ============================================================================
alter table loom_terms enable row level security;
create policy "Users manage own loom terms" on loom_terms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table loom_class_presets enable row level security;
create policy "Users manage own loom presets" on loom_class_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table loom_time_slots enable row level security;
create policy "Users manage own loom slots" on loom_time_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table loom_schedule_blocks enable row level security;
create policy "Users manage own loom blocks" on loom_schedule_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
