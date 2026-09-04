-- ===========================================================================
-- Meridian — public release migration, for the DEVELOPER'S OWN project only.
--
-- Run this once, in the SQL editor of the Supabase project named in
-- VITE_SUPABASE_URL — the one that now handles auth for everybody.
--
-- Do NOT run it in a user's project. Users run supabase/user_setup.sql instead,
-- and the app shows them that file with a copy button; they never see this one.
--
-- It changes nothing about your existing data. Every row you have ever written
-- stays exactly where it is, and your own account keeps reading and writing this
-- project as it always has — that is what the VITE_OWNER_EMAIL bypass is for.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Tell the push dispatcher whose data it cannot see.
--
-- Since the split, everyone except you keeps their module data in a Supabase
-- project of their own, which push-dispatch holds no credentials for and never
-- will. It branches on this column: reminders that need a number are sent
-- without one, and Loom's class reminders and Chronicle's due-today list — which
-- are nothing BUT that data — are not sent at all.
--
-- The default is false, which is correct: your own row keeps working unchanged,
-- and the client stamps the real value on every settings save.
-- ---------------------------------------------------------------------------
alter table meridian_notification_settings
  add column if not exists external_data boolean not null default false;


-- ---------------------------------------------------------------------------
-- 2. Stop seeding Aurum categories for strangers.
--
-- on_auth_user_created fires on every signup to THIS project, and since this
-- project now handles auth for the public, that is eleven category rows written
-- into your database for every person who tries the app — rows they will never
-- see, because their Aurum data is in their own project.
--
-- Dropping the trigger does not touch a single existing row. Your own categories
-- were seeded when you signed up years of commits ago and are unaffected; the
-- trigger only ever ran on INSERT into auth.users.
--
-- The same trigger IS installed in each user's own project by user_setup.sql,
-- where it fires for the account Meridian creates there and seeds their real
-- starting categories. This is the right place to remove it and the right place
-- to keep it.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;


-- ---------------------------------------------------------------------------
-- 3. Check it worked.
-- ---------------------------------------------------------------------------
-- The new column:
--   select column_name, data_type, column_default
--   from information_schema.columns
--   where table_name = 'meridian_notification_settings' and column_name = 'external_data';
--
-- The trigger should return no rows:
--   select tgname from pg_trigger where tgname = 'on_auth_user_created';
--
-- Your own categories should still be there:
--   select count(*) from categories where user_id = auth.uid();
