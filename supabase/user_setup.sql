-- ===========================================================================
-- Meridian — one-time setup for YOUR Supabase project
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It creates every table, index, security rule, storage bucket and trigger the
-- six Meridian apps need. Running it twice is safe: nothing here deletes or
-- overwrites data.
--
-- THIS IS THE FILE THE APP SHOWS YOU. It is the single source of truth for the
-- copy-paste script in the setup walkthrough (src/setup imports this file
-- directly with ?raw), so the two can never drift apart. If you change the
-- schema of a module, change it here as well.
--
-- Contents
--   0.  Platform     — connection check + the sign-up confirmation helper
--   1.  Aurum        — money
--   2.  Kindle       — habits
--   3.  Vigil        — study
--   4.  Loom         — timetable
--   5.  Virtus       — gym
--   6.  Chronicle    — to-dos, notes, voice
--   7.  Storage      — the two private file buckets
--
-- Every table below has Row Level Security switched ON with the same single
-- rule: a row belongs to the account that created it, and no other account can
-- read or write it. That rule is what makes it safe for the app to hold your
-- project's public key in the browser.
-- ===========================================================================


-- ===========================================================================
-- 0. Platform
-- ===========================================================================

-- The table the "Test Connection" button writes to and reads back. One row per
-- account, nothing in it but a timestamp — it exists so the test is a real round
-- trip through your database rather than a guess.
create table if not exists meridian_connection_check (
  user_id uuid primary key references auth.users on delete cascade,
  checked_at timestamptz not null default now()
);

alter table meridian_connection_check enable row level security;
drop policy if exists "Users manage own connection check" on meridian_connection_check;
create policy "Users manage own connection check" on meridian_connection_check
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Marks a brand-new account in THIS project as confirmed.
--
-- Meridian creates one account here on your behalf, so that the security rules
-- above have someone to attach your rows to. If your project still has "Confirm
-- email" switched on, that account is created but cannot sign in until an email
-- that was never sent is answered. This closes that gap.
--
-- It is deliberately narrow: it only ever touches an account that was created in
-- the last fifteen minutes and has never been confirmed. It cannot be used to
-- take over an existing account.
create or replace function public.meridian_confirm_signup(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $confirm$
begin
  update auth.users
     set email_confirmed_at = now()
   where lower(email) = lower(trim(target_email))
     and email_confirmed_at is null
     and created_at > now() - interval '15 minutes';
end;
$confirm$;

revoke all on function public.meridian_confirm_signup(text) from public;
grant execute on function public.meridian_confirm_signup(text) to anon, authenticated;


-- ===========================================================================
-- 1. Aurum — money
-- ===========================================================================

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  parent_id uuid references categories(id),
  icon text,
  color text not null default '#C9A46A',
  is_business boolean default false,
  archived boolean default false,
  created_at timestamptz default now()
);

create table if not exists quick_add_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories(id) not null,
  amount numeric(10, 2) not null,
  label text not null,
  type text not null check (type in ('income', 'expense')),
  is_business boolean default false,
  use_count int default 0,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories(id) not null,
  amount numeric(10, 2) not null,
  type text not null check (type in ('income', 'expense')),
  date date not null default current_date,
  notes text,
  payment_mode text check (payment_mode in ('cash', 'upi', 'card')),
  is_business boolean default false,
  -- on delete set null: deleting a used preset must not be blocked by (or cascade
  -- into) the transactions that were logged from it.
  preset_id uuid references quick_add_presets(id) on delete set null,
  receipt_url text,
  created_at timestamptz default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories(id) not null,
  monthly_limit numeric(10, 2) not null,
  created_at timestamptz default now()
);

create index if not exists transactions_user_date_idx on transactions (user_id, date desc);
create index if not exists transactions_category_idx on transactions (category_id);
create index if not exists categories_user_idx on categories (user_id, type);
create index if not exists budgets_user_idx on budgets (user_id);
create index if not exists quick_add_presets_user_idx on quick_add_presets (user_id);

alter table categories enable row level security;
drop policy if exists "Users manage own categories" on categories;
create policy "Users manage own categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table quick_add_presets enable row level security;
drop policy if exists "Users manage own presets" on quick_add_presets;
create policy "Users manage own presets" on quick_add_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table transactions enable row level security;
drop policy if exists "Users manage own transactions" on transactions;
create policy "Users manage own transactions" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table budgets enable row level security;
drop policy if exists "Users manage own budgets" on budgets;
create policy "Users manage own budgets" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NO SEED CATEGORIES, and this is deliberate.
--
-- An earlier version of this script installed a trigger that wrote a starting set
-- of categories into every new account: Allowance, Gifts, Business → Recurring
-- Retainer / One-time Project, College Essentials, Canteen, Eating Out,
-- Transport, Subscriptions, Misc.
--
-- That list is not neutral scaffolding — it is a portrait of one person. It
-- assumes you are a student living on an allowance, eating at a college canteen,
-- and freelancing on retainers. Handing it to a stranger as "your categories"
-- gets the app wrong about them on the first screen.
--
-- So Aurum starts empty, and the app has a designed first-run state that walks
-- you into making the categories you actually use. Yours, not somebody else's.
--
-- If you are upgrading a project created by the older script, the trigger is
-- removed here. Any categories it already wrote are left exactly as they are —
-- this drops the trigger, never the rows.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();


-- ===========================================================================
-- 2. Kindle — habits
-- ===========================================================================

create table if not exists kindle_habits (
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

create table if not exists kindle_habit_logs (
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

create table if not exists kindle_pin (
  user_id uuid primary key references auth.users,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz default now()
);

create index if not exists kindle_habits_user_idx on kindle_habits (user_id, position);
create index if not exists kindle_habit_logs_user_date_idx on kindle_habit_logs (user_id, date);

alter table kindle_habits enable row level security;
drop policy if exists "Users manage own kindle habits" on kindle_habits;
create policy "Users manage own kindle habits" on kindle_habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table kindle_habit_logs enable row level security;
drop policy if exists "Users manage own kindle habit logs" on kindle_habit_logs;
create policy "Users manage own kindle habit logs" on kindle_habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table kindle_pin enable row level security;
drop policy if exists "Users manage own kindle pin" on kindle_pin;
create policy "Users manage own kindle pin" on kindle_pin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ===========================================================================
-- 3. Vigil — study
-- ===========================================================================

create table if not exists vigil_days (
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

create index if not exists vigil_days_user_date_idx on vigil_days (user_id, date);

create table if not exists vigil_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  label text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table if not exists vigil_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references vigil_categories(id) on delete cascade not null,
  label text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table if not exists vigil_subtopics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  subject_id uuid references vigil_subjects(id) on delete cascade not null,
  label text not null,
  position int not null default 0,
  completed boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists vigil_subjects_category_idx on vigil_subjects (category_id);
create index if not exists vigil_subtopics_subject_idx on vigil_subtopics (subject_id);

create table if not exists vigil_pin (
  user_id uuid primary key references auth.users,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz default now()
);

alter table vigil_days enable row level security;
drop policy if exists "Users manage own vigil days" on vigil_days;
create policy "Users manage own vigil days" on vigil_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table vigil_categories enable row level security;
drop policy if exists "Users manage own vigil categories" on vigil_categories;
create policy "Users manage own vigil categories" on vigil_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table vigil_subjects enable row level security;
drop policy if exists "Users manage own vigil subjects" on vigil_subjects;
create policy "Users manage own vigil subjects" on vigil_subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table vigil_subtopics enable row level security;
drop policy if exists "Users manage own vigil subtopics" on vigil_subtopics;
create policy "Users manage own vigil subtopics" on vigil_subtopics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table vigil_pin enable row level security;
drop policy if exists "Users manage own vigil pin" on vigil_pin;
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



-- ===========================================================================
-- 4. Loom — timetable
--
-- Loom keeps its real copy on the phone so it works with no signal at all; these
-- tables are the backup that lets a second device catch up. Ids are text because
-- they are generated on the device, possibly while offline.
-- ===========================================================================

create table if not exists loom_terms (
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

create table if not exists loom_class_presets (
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

create table if not exists loom_time_slots (
  id text primary key,
  user_id uuid references auth.users not null,
  term_id text not null,
  position int not null default 0,
  start_time text not null,
  end_time text not null,
  deleted boolean not null default false,
  updated_at timestamptz not null
);

create table if not exists loom_schedule_blocks (
  id text primary key,
  user_id uuid references auth.users not null,
  term_id text not null,
  label text,
  effective_from date not null,
  assignments jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null
);

create index if not exists loom_presets_term_idx on loom_class_presets (user_id, term_id);
create index if not exists loom_slots_term_idx on loom_time_slots (user_id, term_id);
create index if not exists loom_blocks_term_idx on loom_schedule_blocks (user_id, term_id);
create index if not exists loom_terms_updated_idx on loom_terms (user_id, updated_at);

alter table loom_terms enable row level security;
drop policy if exists "Users manage own loom terms" on loom_terms;
create policy "Users manage own loom terms" on loom_terms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table loom_class_presets enable row level security;
drop policy if exists "Users manage own loom presets" on loom_class_presets;
create policy "Users manage own loom presets" on loom_class_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table loom_time_slots enable row level security;
drop policy if exists "Users manage own loom slots" on loom_time_slots;
create policy "Users manage own loom slots" on loom_time_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table loom_schedule_blocks enable row level security;
drop policy if exists "Users manage own loom blocks" on loom_schedule_blocks;
create policy "Users manage own loom blocks" on loom_schedule_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ===========================================================================
-- 5. Virtus — gym
-- ===========================================================================

create table if not exists virtus_muscle_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  label text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create index if not exists virtus_muscle_groups_user_idx on virtus_muscle_groups (user_id, position);

create table if not exists virtus_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  muscle_group_id uuid references virtus_muscle_groups(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists virtus_exercises_user_idx on virtus_exercises (user_id, archived);

create table if not exists virtus_split_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table if not exists virtus_split_day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  split_day_id uuid references virtus_split_days(id) on delete cascade not null,
  exercise_id uuid references virtus_exercises(id) on delete cascade not null,
  position int not null default 0,
  unique (split_day_id, exercise_id)
);

create index if not exists virtus_sde_split_day_idx on virtus_split_day_exercises (split_day_id, position);

create table if not exists virtus_schedule (
  user_id uuid references auth.users not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  split_day_id uuid references virtus_split_days(id) on delete set null,
  primary key (user_id, day_of_week)
);

create table if not exists virtus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  split_day_id uuid references virtus_split_days(id) on delete set null,
  is_rest_day boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date),
  constraint virtus_session_shape check (
    (is_rest_day and split_day_id is null) or (not is_rest_day and split_day_id is not null)
  )
);

create index if not exists virtus_sessions_user_date_idx on virtus_sessions (user_id, date);

create table if not exists virtus_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  session_id uuid references virtus_sessions(id) on delete cascade not null,
  exercise_id uuid references virtus_exercises(id) on delete restrict not null,
  set_number int not null check (set_number >= 1),
  weight_kg numeric(6, 2) not null check (weight_kg >= 0),
  reps int not null check (reps >= 0),
  logged_at timestamptz default now()
);

create index if not exists virtus_sets_session_idx on virtus_sets (session_id);
create index if not exists virtus_sets_exercise_idx on virtus_sets (exercise_id);

create table if not exists virtus_pin (
  user_id uuid primary key references auth.users,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz default now()
);

alter table virtus_muscle_groups enable row level security;
drop policy if exists "Users manage own virtus muscle groups" on virtus_muscle_groups;
create policy "Users manage own virtus muscle groups" on virtus_muscle_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_exercises enable row level security;
drop policy if exists "Users manage own virtus exercises" on virtus_exercises;
create policy "Users manage own virtus exercises" on virtus_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_split_days enable row level security;
drop policy if exists "Users manage own virtus split days" on virtus_split_days;
create policy "Users manage own virtus split days" on virtus_split_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_split_day_exercises enable row level security;
drop policy if exists "Users manage own virtus split day exercises" on virtus_split_day_exercises;
create policy "Users manage own virtus split day exercises" on virtus_split_day_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_schedule enable row level security;
drop policy if exists "Users manage own virtus schedule" on virtus_schedule;
create policy "Users manage own virtus schedule" on virtus_schedule
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_sessions enable row level security;
drop policy if exists "Users manage own virtus sessions" on virtus_sessions;
create policy "Users manage own virtus sessions" on virtus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_sets enable row level security;
drop policy if exists "Users manage own virtus sets" on virtus_sets;
create policy "Users manage own virtus sets" on virtus_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table virtus_pin enable row level security;
drop policy if exists "Users manage own virtus pin" on virtus_pin;
create policy "Users manage own virtus pin" on virtus_pin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ===========================================================================
-- 6. Chronicle — to-dos, notes, voice
-- ===========================================================================

create table if not exists chronicle_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  label text not null check (length(trim(label)) > 0),
  created_at timestamptz default now()
);

create unique index if not exists chronicle_tags_unique on chronicle_tags (user_id, lower(label));

create table if not exists chronicle_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  is_secret boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists chronicle_notes_user_idx on chronicle_notes (user_id, is_secret, updated_at desc);

create table if not exists chronicle_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null check (length(trim(title)) > 0),
  notes text not null default '',
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH')),
  due_date date,
  is_complete boolean not null default false,
  completed_at timestamptz,
  recurrence text check (recurrence in ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  recurrence_interval int check (recurrence_interval is null or recurrence_interval >= 1),
  series_id uuid not null default gen_random_uuid(),
  spawned_todo_id uuid references chronicle_todos(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint chronicle_todos_custom_interval check (
    (recurrence = 'CUSTOM' and recurrence_interval is not null)
    or (recurrence is distinct from 'CUSTOM' and recurrence_interval is null)
  )
);

create index if not exists chronicle_todos_user_idx on chronicle_todos (user_id, is_complete, due_date);
create index if not exists chronicle_todos_series_idx on chronicle_todos (series_id);

create table if not exists chronicle_voice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default '',
  audio_path text not null,
  duration_seconds numeric(8, 2) not null default 0,
  transcript text not null default '',
  transcript_status text not null default 'pending'
    check (transcript_status in ('pending', 'done', 'failed')),
  transcript_source text check (transcript_source in ('groq', 'browser', 'manual')),
  transcript_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists chronicle_voice_user_idx on chronicle_voice (user_id, created_at desc);

create table if not exists chronicle_item_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  tag_id uuid references chronicle_tags(id) on delete cascade not null,
  item_type text not null check (item_type in ('todo', 'note', 'voice')),
  item_id uuid not null,
  unique (tag_id, item_id)
);

create index if not exists chronicle_item_tags_item_idx on chronicle_item_tags (user_id, item_type, item_id);

create table if not exists chronicle_todo_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  todo_id uuid references chronicle_todos(id) on delete cascade not null,
  item_type text not null check (item_type in ('note', 'voice')),
  item_id uuid not null,
  created_at timestamptz default now(),
  unique (todo_id, item_type, item_id)
);

create index if not exists chronicle_todo_links_item_idx on chronicle_todo_links (user_id, item_type, item_id);

create table if not exists chronicle_secret_pin (
  user_id uuid primary key references auth.users,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Deleting a note or a voice memo takes its tag rows and its links with it.
-- Those cannot be real foreign keys (one column points at three different
-- tables), so the database does the tidying rather than trusting whichever
-- screen happened to press delete.
create or replace function chronicle_cleanup_note()
returns trigger language plpgsql as $fn$
begin
  delete from chronicle_item_tags where item_type = 'note' and item_id = old.id;
  delete from chronicle_todo_links where item_type = 'note' and item_id = old.id;
  return old;
end;
$fn$;

drop trigger if exists chronicle_notes_cleanup on chronicle_notes;
create trigger chronicle_notes_cleanup after delete on chronicle_notes
  for each row execute function chronicle_cleanup_note();

create or replace function chronicle_cleanup_voice()
returns trigger language plpgsql as $fn$
begin
  delete from chronicle_item_tags where item_type = 'voice' and item_id = old.id;
  delete from chronicle_todo_links where item_type = 'voice' and item_id = old.id;
  return old;
end;
$fn$;

drop trigger if exists chronicle_voice_cleanup on chronicle_voice;
create trigger chronicle_voice_cleanup after delete on chronicle_voice
  for each row execute function chronicle_cleanup_voice();

create or replace function chronicle_cleanup_todo()
returns trigger language plpgsql as $fn$
begin
  delete from chronicle_item_tags where item_type = 'todo' and item_id = old.id;
  return old;
end;
$fn$;

drop trigger if exists chronicle_todos_cleanup on chronicle_todos;
create trigger chronicle_todos_cleanup after delete on chronicle_todos
  for each row execute function chronicle_cleanup_todo();

-- A private note can never be attached to a to-do. The to-do screen is ordinary,
-- unlocked UI, so a link there would announce that the note exists — which is the
-- one thing the private section is for. The app never offers it; this makes it
-- impossible rather than merely unoffered.
create or replace function chronicle_reject_secret_link()
returns trigger language plpgsql as $fn$
begin
  if new.item_type = 'note'
     and exists (select 1 from chronicle_notes where id = new.item_id and is_secret) then
    raise exception 'Secret notes cannot be linked to to-dos';
  end if;
  return new;
end;
$fn$;

drop trigger if exists chronicle_todo_links_no_secrets on chronicle_todo_links;
create trigger chronicle_todo_links_no_secrets before insert or update on chronicle_todo_links
  for each row execute function chronicle_reject_secret_link();

-- ...and the same rule from the other side: moving a note into the private
-- section withdraws any links it already had.
create or replace function chronicle_unlink_on_secret()
returns trigger language plpgsql as $fn$
begin
  if new.is_secret and not old.is_secret then
    delete from chronicle_todo_links where item_type = 'note' and item_id = new.id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists chronicle_notes_unlink_on_secret on chronicle_notes;
create trigger chronicle_notes_unlink_on_secret after update of is_secret on chronicle_notes
  for each row execute function chronicle_unlink_on_secret();

alter table chronicle_tags enable row level security;
drop policy if exists "Users manage own chronicle tags" on chronicle_tags;
create policy "Users manage own chronicle tags" on chronicle_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_notes enable row level security;
drop policy if exists "Users manage own chronicle notes" on chronicle_notes;
create policy "Users manage own chronicle notes" on chronicle_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_todos enable row level security;
drop policy if exists "Users manage own chronicle todos" on chronicle_todos;
create policy "Users manage own chronicle todos" on chronicle_todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_voice enable row level security;
drop policy if exists "Users manage own chronicle voice" on chronicle_voice;
create policy "Users manage own chronicle voice" on chronicle_voice
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_item_tags enable row level security;
drop policy if exists "Users manage own chronicle item tags" on chronicle_item_tags;
create policy "Users manage own chronicle item tags" on chronicle_item_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_todo_links enable row level security;
drop policy if exists "Users manage own chronicle todo links" on chronicle_todo_links;
create policy "Users manage own chronicle todo links" on chronicle_todo_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_secret_pin enable row level security;
drop policy if exists "Users manage own chronicle secret pin" on chronicle_secret_pin;
create policy "Users manage own chronicle secret pin" on chronicle_secret_pin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ===========================================================================
-- 7. Storage — two private buckets
--
--   receipts    photos attached to a transaction in Aurum
--   chronicle   voice recordings and images pasted into notes
--
-- Both are PRIVATE. Nothing in either is reachable by a link: every file is
-- served through a short-lived signed URL that the app asks for while you are
-- signed in. Files are stored under your own account id, and the rules below
-- only ever let an account touch its own folder — so nobody can guess, list, or
-- read anybody else's.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('receipts', 'receipts', false, 10485760)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public, file_size_limit)
values ('chronicle', 'chronicle', false, 26214400)
on conflict (id) do update set public = false;

drop policy if exists "Users manage own receipts" on storage.objects;
create policy "Users manage own receipts"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users manage own chronicle media" on storage.objects;
create policy "Users manage own chronicle media"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'chronicle' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'chronicle' and (storage.foldername(name))[1] = auth.uid()::text);


-- ===========================================================================
-- Done. Go back to Meridian and press Test Connection.
-- ===========================================================================
