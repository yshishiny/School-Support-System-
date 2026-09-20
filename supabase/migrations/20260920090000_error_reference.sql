-- A failure a person can report. The reference is shown on screen and stored here, so "it said k3f9a2"
-- finds the one row: the function it happened in, what the database actually said, and who was holding
-- the phone at the time.
alter table public.app_errors add column if not exists ref text;
create index if not exists app_errors_ref_idx on public.app_errors(ref) where ref is not null;
