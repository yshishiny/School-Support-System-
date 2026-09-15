-- Pre-prepared quizzes: a quiz can be scheduled for a date in a weekly plan.
alter table public.quizzes
  add column scheduled_for date,
  add column plan_slot text check (plan_slot in ('school', 'exam'));
create index quizzes_plan_idx on public.quizzes(student_id, scheduled_for) where scheduled_for is not null;
