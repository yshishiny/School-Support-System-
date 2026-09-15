-- One planned quiz per student, day and slot, even when two "Prepare" loops run at the same time.
create unique index quizzes_plan_slot_unique on public.quizzes(student_id, scheduled_for, plan_slot) where scheduled_for is not null;
