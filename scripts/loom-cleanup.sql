-- Loom full wipe — one-off, run by hand in Supabase's SQL editor.
--
-- Deletes every Loom row on your account across all four tables, so you can
-- set up one clean term from scratch. Hard delete — irreversible, no undo.
-- Safe here because your phone's local copy is already empty (confirmed after
-- the last reinstall), so there is nothing cached locally left to reconcile —
-- see the note in git history / earlier conversation if you want the reasoning
-- for why that matters.

select id, email from auth.users;

-- Paste your id from the query above into '<UID>' below, then run this whole
-- block together. Order matters for hygiene (children before parents), even
-- though these tables carry no formal foreign key back to loom_terms.
delete from loom_schedule_blocks where user_id = '<UID>';
delete from loom_time_slots where user_id = '<UID>';
delete from loom_class_presets where user_id = '<UID>';
delete from loom_terms where user_id = '<UID>';

-- ============================================================================
-- After this runs, loom_terms/loom_class_presets/loom_time_slots/
-- loom_schedule_blocks are all empty for your account. Open Loom → Terms and
-- "Start new term" to set up your one, final timetable.
--
-- IMPORTANT: do this only AFTER the race-condition fix (Terms.tsx,
-- Timetable.tsx, the dashboard's Loom card, loom/lib/sync.ts) has been
-- committed, pushed, and redeployed — otherwise you're setting this up on the
-- same code that produced the duplicates in the first place. Once it's live,
-- just reopen the existing Home Screen icon; do not delete and re-add it.
-- ============================================================================
