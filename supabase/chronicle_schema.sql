-- Chronicle — Supabase schema (sixth Meridian module, alongside Aurum, Kindle,
-- Vigil, Loom and Virtus). Run this whole file once in the Supabase SQL editor.
-- Independent of the other modules' tables — no foreign keys cross module
-- boundaries. Same auth.uid()-scoped RLS pattern as every other module.
--
-- There is also a storage bucket and an Edge Function to set up; see the
-- "Chronicle" section of SETUP.md for both. Nothing here seeds data: every tag,
-- note, to-do and voice entry is user-created.

-- ============================================================================
-- 1. chronicle_tags
-- ONE shared vocabulary across to-dos, notes and voice entries — the brief's
-- rule that the same tag means the same thing everywhere. Uniqueness is on
-- lower(label) so "Uni" and "uni" cannot both exist and silently split a filter.
-- Deleting a tag cascades into chronicle_item_tags (i.e. it is removed from the
-- items that carried it) and never touches the items themselves.
-- ============================================================================
create table chronicle_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  label text not null check (length(trim(label)) > 0),
  created_at timestamptz default now()
);

create unique index chronicle_tags_unique on chronicle_tags (user_id, lower(label));

-- ============================================================================
-- 2. chronicle_notes
-- Notes and memos are ONE type — there is deliberately no `kind` column, because
-- the brief forbids modelling memos separately.
--
-- body_html is the rich text as TipTap serialises it. body_text is a plain-text
-- mirror written by the client on every save, and it exists purely so global
-- search can match note content without every client having to parse HTML — an
-- ilike over body_html would happily match on markup like "strong".
--
-- is_secret is the ONLY thing separating a secret note from a normal one; they
-- share this table. The normal Notes list and global search both query with
-- is_secret = false, so a secret note is never even fetched outside the unlocked
-- section, rather than being fetched and then filtered out in the client.
-- ============================================================================
create table chronicle_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  is_secret boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index chronicle_notes_user_idx on chronicle_notes (user_id, is_secret, updated_at desc);

-- ============================================================================
-- 3. chronicle_todos
-- priority is a FIXED enum (the brief explicitly makes it non-customisable),
-- unlike tags which are user-defined.
--
-- Recurrence model: each occurrence is its own row. Completing a recurring
-- occurrence marks that row complete AND inserts the next one, so past
-- occurrences stay in history exactly as they happened. series_id is shared by
-- every occurrence descended from one original, so a series can be found again;
-- spawned_todo_id points from a completed occurrence at the one it generated, so
-- un-completing can withdraw that successor instead of leaving a duplicate.
--
-- recurrence_interval only means anything for CUSTOM (every N days); the check
-- constraint stops a fixed cadence from carrying a stray interval that would
-- silently disagree with its own name.
-- ============================================================================
create table chronicle_todos (
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

create index chronicle_todos_user_idx on chronicle_todos (user_id, is_complete, due_date);
create index chronicle_todos_series_idx on chronicle_todos (series_id);

-- ============================================================================
-- 4. chronicle_voice
-- The audio file itself lives in the `chronicle` storage bucket; audio_path is
-- its key within that bucket, always prefixed with the owner's user id so the
-- bucket policy below can scope it.
--
-- transcript_status is what lets transcription be asynchronous without the UI
-- having to guess: 'pending' renders a transcribing state, 'failed' renders a
-- retry affordance, and in BOTH cases the row and its audio already exist and
-- are playable. Losing the audio because transcription failed is the one outcome
-- this table is shaped to make impossible.
-- ============================================================================
create table chronicle_voice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default '',
  audio_path text not null,
  duration_seconds numeric(8, 2) not null default 0,
  transcript text not null default '',
  transcript_status text not null default 'pending'
    check (transcript_status in ('pending', 'done', 'failed')),
  -- 'groq' | 'browser' | 'manual' — kept so a browser-fallback transcript, which
  -- is markedly less accurate, can be labelled as such rather than passed off as
  -- the real thing.
  transcript_source text check (transcript_source in ('groq', 'browser', 'manual')),
  transcript_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index chronicle_voice_user_idx on chronicle_voice (user_id, created_at desc);

-- ============================================================================
-- 5. chronicle_item_tags  +  chronicle_todo_links
-- Both are polymorphic (item_type + item_id) rather than one join table per
-- target type, because the whole point of the tag vocabulary is that one tag
-- spans all three types — three typed tables would need every tag query to be a
-- three-way union.
--
-- The cost of polymorphism is that item_id cannot be a real foreign key, so
-- deleting a note would otherwise leave its tag rows behind forever. The
-- triggers below are the fix: cleanup happens in the database, not in whichever
-- client code path happened to do the delete.
-- ============================================================================
create table chronicle_item_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  tag_id uuid references chronicle_tags(id) on delete cascade not null,
  item_type text not null check (item_type in ('todo', 'note', 'voice')),
  item_id uuid not null,
  unique (tag_id, item_id)
);

create index chronicle_item_tags_item_idx on chronicle_item_tags (user_id, item_type, item_id);

create table chronicle_todo_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  todo_id uuid references chronicle_todos(id) on delete cascade not null,
  item_type text not null check (item_type in ('note', 'voice')),
  item_id uuid not null,
  created_at timestamptz default now(),
  unique (todo_id, item_type, item_id)
);

create index chronicle_todo_links_item_idx on chronicle_todo_links (user_id, item_type, item_id);

-- Deleting a to-do drops its links (real FK, above) but must NOT touch the note
-- or voice entry on the other end — the brief is explicit that unlinking is not
-- deleting. That is why there is no cascade in that direction anywhere.
create or replace function chronicle_cleanup_note()
returns trigger language plpgsql as $fn$
begin
  delete from chronicle_item_tags where item_type = 'note' and item_id = old.id;
  delete from chronicle_todo_links where item_type = 'note' and item_id = old.id;
  return old;
end;
$fn$;

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

create trigger chronicle_voice_cleanup after delete on chronicle_voice
  for each row execute function chronicle_cleanup_voice();

create or replace function chronicle_cleanup_todo()
returns trigger language plpgsql as $fn$
begin
  delete from chronicle_item_tags where item_type = 'todo' and item_id = old.id;
  return old;
end;
$fn$;

create trigger chronicle_todos_cleanup after delete on chronicle_todos
  for each row execute function chronicle_cleanup_todo();

-- A secret note must never be linkable to a to-do: the to-do detail view is
-- normal, unlocked UI, so a link there would advertise that the note exists —
-- which is exactly what the hidden section exists to avoid. The UI never offers
-- it; this is the backstop that makes it impossible rather than merely unoffered.
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

create trigger chronicle_todo_links_no_secrets before insert or update on chronicle_todo_links
  for each row execute function chronicle_reject_secret_link();

-- ...and the same rule enforced from the other side: if a note is ever flipped
-- to secret, any links it already had are withdrawn rather than left pointing
-- into the normal UI.
create or replace function chronicle_unlink_on_secret()
returns trigger language plpgsql as $fn$
begin
  if new.is_secret and not old.is_secret then
    delete from chronicle_todo_links where item_type = 'note' and item_id = new.id;
  end if;
  return new;
end;
$fn$;

create trigger chronicle_notes_unlink_on_secret after update of is_secret on chronicle_notes
  for each row execute function chronicle_unlink_on_secret();

-- ============================================================================
-- 6. chronicle_secret_pin
-- Chronicle's Secret Notes PIN. Deliberately its OWN table and its own hook
-- (src/chronicle/hooks/useSecretPin.ts) rather than a row in the per-module PIN
-- storage that Kindle, Vigil and Virtus share via src/hooks/usePinTable.ts:
-- those gate "are you sure you want to edit history", this one gates a hidden
-- section, and it is a variable-length passphrase rather than a 4-digit code
-- because it is typed into the search field, where four digits would be far too
-- easy to reach by accident.
--
-- It shares the salted-SHA-256 helpers in src/lib/pin.ts, and the same honest
-- caveat applies: this is UI concealment, not encryption. RLS scopes these rows
-- to the account; anyone already holding the signed-in session could read the
-- notes table directly. The PIN hides the section — it does not encrypt it.
-- ============================================================================
create table chronicle_secret_pin (
  user_id uuid primary key references auth.users,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- Row Level Security — every table user_id-scoped, no exceptions.
-- ============================================================================
alter table chronicle_tags enable row level security;
create policy "Users manage own chronicle tags" on chronicle_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_notes enable row level security;
create policy "Users manage own chronicle notes" on chronicle_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_todos enable row level security;
create policy "Users manage own chronicle todos" on chronicle_todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_voice enable row level security;
create policy "Users manage own chronicle voice" on chronicle_voice
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_item_tags enable row level security;
create policy "Users manage own chronicle item tags" on chronicle_item_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_todo_links enable row level security;
create policy "Users manage own chronicle todo links" on chronicle_todo_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table chronicle_secret_pin enable row level security;
create policy "Users manage own chronicle secret pin" on chronicle_secret_pin
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- Storage — one private bucket named `chronicle`, holding both voice audio
-- (<uid>/audio/...) and images embedded in notes (<uid>/images/...). One bucket
-- rather than two because the policy is identical and it is one less setup step;
-- the prefixes keep them apart.
--
-- Create the bucket in the dashboard (Storage -> New bucket -> name it
-- `chronicle`, leave it Private). Either order works: this policy names the
-- bucket as a literal rather than referencing a row, so it can be created before
-- the bucket exists and simply starts applying once it does.
-- ============================================================================
create policy "Users manage own chronicle media"
  on storage.objects for all
  using (bucket_id = 'chronicle' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'chronicle' and (storage.foldername(name))[1] = auth.uid()::text);
