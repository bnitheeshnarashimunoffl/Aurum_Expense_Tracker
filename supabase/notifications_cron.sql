-- Meridian — cron schedule for the push dispatcher.
--
-- Run this in the Supabase SQL editor AFTER:
--   1. supabase/notifications_schema.sql has been run, and
--   2. `supabase functions deploy push-dispatch --no-verify-jwt` has succeeded.
--
-- BEFORE YOU RUN IT, replace the two placeholders at the top of the DO block:
--   <PROJECT_REF>  the xxxxxxxx in your https://xxxxxxxx.supabase.co URL
--   <CRON_SECRET>  the exact same string you passed to
--                  `supabase secrets set CRON_SECRET=...`
--
-- !! NEVER COMMIT THE REAL VALUES. !!
--
-- push-dispatch is deployed with --no-verify-jwt, so CRON_SECRET is the ONLY
-- thing standing between the function's URL and anyone who wants to make it
-- send. An earlier revision of this file carried a real secret, and it is
-- therefore in this repository's git history forever — rotating it is what makes
-- that copy worthless, and the rotation steps are in SETUP.md under
-- "Rotating the cron secret". Do that before the app is shared with anyone.
--
-- Fill the two values in, run the file, then UNDO your edit before committing —
-- or keep the filled-in copy outside the repo entirely.
--
-- WHY EVERY MINUTE: Loom's reminders are "30 minutes before the class starts",
-- and a class can start at any minute. An hourly cron could only ever be right
-- for classes on the hour. Running each minute also means one skipped tick is
-- not a skipped day. It cannot cause duplicate notifications — every send is
-- claimed against the unique key on meridian_notification_log first, so the
-- second attempt in a given hour simply finds the slot already taken.
--
-- Cost: 1,440 invocations a day, each one usually a single SELECT that matches
-- nothing. Well inside Supabase's free Edge Function allowance.

-- pg_cron and pg_net are both available on Supabase but off by default.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $cron$
declare
  project_ref text := '<PROJECT_REF>';
  cron_secret text := '<CRON_SECRET>';
begin
  -- Unschedule first so re-running this file updates the job instead of failing.
  perform cron.unschedule('meridian-push-dispatch')
    where exists (select 1 from cron.job where jobname = 'meridian-push-dispatch');

  perform cron.schedule(
    'meridian-push-dispatch',
    '* * * * *',
    format(
      $job$
      select net.http_post(
        url     := 'https://%s.supabase.co/functions/v1/push-dispatch',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 25000
      );
      $job$,
      project_ref,
      cron_secret
    )
  );

  -- The log only exists to make sends idempotent within the day they cover, so
  -- a weekly sweep keeps it from growing forever.
  perform cron.unschedule('meridian-prune-notification-log')
    where exists (select 1 from cron.job where jobname = 'meridian-prune-notification-log');

  perform cron.schedule(
    'meridian-prune-notification-log',
    '17 4 * * 0',
    'select public.meridian_prune_notification_log();'
  );
end;
$cron$;

-- ============================================================================
-- Checking it works
-- ============================================================================
-- The jobs themselves:
--   select jobid, jobname, schedule, active from cron.job;
--
-- The last few runs (look for status = 'succeeded'):
--   select runid, jobid, status, return_message, start_time
--   from cron.job_run_details order by start_time desc limit 20;
--
-- What the function actually returned (pg_net keeps responses briefly):
--   select id, status_code, content from net._http_response order by id desc limit 20;
--   A healthy tick answers 200 with {"checked":1,"sent":0,...} on most minutes —
--   "sent 0" is correct whenever nothing is due at that exact minute.
--
-- To stop notifications entirely at the source:
--   select cron.unschedule('meridian-push-dispatch');
-- (The in-app master toggle is the normal way to do this; it is respected
--  server-side, so the cron keeps running and simply sends nothing.)
