-- A chore two children share and take in turns (the cats' litter, the bins): one snap task whose owner
-- changes on a fixed cycle. The turn is written back into student_id so every version of the app, old or
-- new, simply sees "this task belongs to that child this week".
alter table public.snap_tasks add column if not exists rota_student_ids uuid[];
alter table public.snap_tasks add column if not exists rota_period text;
alter table public.snap_tasks add column if not exists rota_since date;

alter table public.snap_tasks drop constraint if exists snap_tasks_rota_period_check;
alter table public.snap_tasks add constraint snap_tasks_rota_period_check check (rota_period is null or rota_period in ('day', 'week'));

comment on column public.snap_tasks.rota_student_ids is 'Children sharing this chore, in turn order; null = not a rota.';
comment on column public.snap_tasks.rota_period is 'day or week: how long one child keeps the chore.';
comment on column public.snap_tasks.rota_since is 'The first day of the first turn; the turn is computed from this date, so both apps agree.';
