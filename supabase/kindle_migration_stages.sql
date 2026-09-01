-- Kindle — migration to the multi-stage progress-pill model.
-- Run once, after supabase/kindle_schema.sql, in the Supabase SQL editor.
-- Preserves existing habit rows and log history — this is an ALTER + backfill,
-- not a drop/recreate, since the account already has real logged data.

-- ============================================================================
-- 1. kindle_habits — add stage configuration columns.
-- Defaults (binary, max_stage 1) are a safe fallback for any habit row this
-- migration's label-matched backfill below doesn't recognize (e.g. a custom
-- habit you'd already added yourself) — it'll behave as a binary habit until
-- you edit it in Settings.
-- ============================================================================
alter table kindle_habits
  add column type text not null default 'binary' check (type in ('binary', 'multi_stage')),
  add column max_stage int not null default 1 check (max_stage between 1 and 10),
  add column target_value numeric,
  add column target_unit text,
  add column palette_key text;

-- Backfill the 8 original habits by their seeded label text. Study's target
-- moved from 6 to 5 hours in this revision (Part 2's stage table is authoritative),
-- so its label is updated too, matching src/kindle/lib/types.ts's DEFAULT_HABITS.
update kindle_habits set type = 'multi_stage', max_stage = 4, target_value = 4, target_unit = 'litres', palette_key = null
  where label = 'Water intake (4 litres/day)';
update kindle_habits set type = 'binary', max_stage = 1, target_value = null, target_unit = null, palette_key = null
  where label = 'Gym';
update kindle_habits set type = 'multi_stage', max_stage = 8, target_value = 8, target_unit = 'hours', palette_key = null
  where label = 'Sleep (8 hours)';
update kindle_habits set label = 'Study (5 hours)', type = 'multi_stage', max_stage = 5, target_value = 5, target_unit = 'hours', palette_key = null
  where label = 'Study (6 hours)';
update kindle_habits set type = 'binary', max_stage = 1, target_value = null, target_unit = null, palette_key = null
  where label = 'Skincare routine';
update kindle_habits set type = 'multi_stage', max_stage = 2, target_value = 2, target_unit = 'baths', palette_key = 'baths'
  where label = 'Baths (two/day)';
update kindle_habits set type = 'multi_stage', max_stage = 4, target_value = 100, target_unit = 'grams', palette_key = null
  where label = 'Protein intake (100g/day, natural sources)';
update kindle_habits set type = 'binary', max_stage = 1, target_value = null, target_unit = null, palette_key = null
  where label = 'Avoiding processed foods';

-- ============================================================================
-- 2. kindle_habit_logs — replace the boolean with an integer stage.
-- Backfill: a previously-completed log becomes that habit's (now-set) max_stage;
-- an incomplete one becomes 0. Historical stage values are NOT retroactively
-- rewritten if you change a habit's max_stage again later — see Settings.
-- ============================================================================
alter table kindle_habit_logs add column stage int not null default 0;

update kindle_habit_logs l
set stage = case when l.completed then h.max_stage else 0 end
from kindle_habits h
where h.id = l.habit_id;

alter table kindle_habit_logs drop column completed;
