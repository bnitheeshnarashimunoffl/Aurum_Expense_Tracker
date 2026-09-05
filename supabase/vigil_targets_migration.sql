-- Vigil — settable weekly study target.
--
-- Run once, in the SQL editor of any project set up BEFORE this table existed:
-- your own auth/data project, and any user project created with an older copy
-- of user_setup.sql. Re-running it is safe and touches no existing data.
--
-- Nothing breaks without it. The app falls back to the five-hour default when
-- the table is missing, exactly as it does for a week with no row in it.

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
