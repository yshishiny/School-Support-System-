-- An older sister's tick is a recommendation, not the decision: the snap stays pending until a parent confirms,
-- and no points move until then.
alter table public.snaps add column if not exists rater_verdict text;
alter table public.snaps add column if not exists rater_id uuid references public.profiles(id) on delete set null;
alter table public.snaps add column if not exists rater_at timestamptz;
alter table public.snaps add column if not exists rater_note text;

alter table public.snaps drop constraint if exists snaps_rater_verdict_check;
alter table public.snaps add constraint snaps_rater_verdict_check check (rater_verdict is null or rater_verdict in ('approved', 'rejected'));

comment on column public.snaps.rater_verdict is 'What an older sibling marked as a rater recommended; a parent still decides.';
