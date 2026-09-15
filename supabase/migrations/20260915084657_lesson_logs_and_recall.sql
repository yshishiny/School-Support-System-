-- Daily "what did you take today" notes per subject, and recall quizzes built from them.
create table public.lesson_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  subject_name text not null,
  note text not null,
  created_at timestamptz not null default now(),
  unique (student_id, log_date, subject_name)
);
create index lesson_logs_student_date_idx on public.lesson_logs(student_id, log_date desc);

alter table public.lesson_logs enable row level security;
create policy lesson_logs_select on public.lesson_logs for select to authenticated using (app_private.student_in_family(student_id));
create policy lesson_logs_student_write on public.lesson_logs for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

alter table public.quizzes add column recall_date date;
