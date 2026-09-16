-- Checkpoints: timed, one-attempt tests built from what the child logged this week (class notes, files),
-- so the self-report and the score can be compared. Weekly (auto, the day before pay day) or a parent's spot check.
create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete set null,
  kind text not null check (kind in ('weekly', 'spot')),
  week_start date not null,
  subject text,                                   -- spot checks: one subject
  time_limit_min int not null default 20,
  due_by date not null,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'ready' check (status in ('ready', 'done', 'expired', 'failed')),
  result jsonb,                                   -- {score,total,bySubject:{subject:{correct,total,claimed}}}
  error text,
  created_at timestamptz not null default now()
);
create index checkpoints_student_idx on public.checkpoints(student_id, created_at desc);
alter table public.checkpoints enable row level security;
create policy checkpoints_family_select on public.checkpoints for select to authenticated using (app_private.student_in_family(student_id));
create policy checkpoints_parent_write on public.checkpoints for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

alter table public.quizzes add column checkpoint_id uuid references public.checkpoints(id) on delete set null;
alter table public.quizzes add column time_limit_min int;
