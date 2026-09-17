-- "I haven't taken this yet": the child flags a quiz topic; the planner skips it until the class log says it was taught.
create table public.topic_flags (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  kind text not null default 'not_taken' check (kind in ('not_taken')),
  created_at timestamptz not null default now(),
  unique (student_id, topic_id, kind)
);
alter table public.topic_flags enable row level security;
create policy topic_flags_family_select on public.topic_flags for select to authenticated using (app_private.student_in_family(student_id));
create policy topic_flags_student_write on public.topic_flags for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
