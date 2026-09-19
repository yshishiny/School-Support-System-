-- A lesson is saved and opened before its pictures are drawn, so "being drawn" (visuals_version = 0) is now a
-- state a script can be left in when the background job dies. Stamp the claim so the nightly job can tell a
-- drawing in progress from one that was abandoned, and hand the abandoned ones back.
alter table public.lesson_scripts add column if not exists visuals_started_at timestamptz;
