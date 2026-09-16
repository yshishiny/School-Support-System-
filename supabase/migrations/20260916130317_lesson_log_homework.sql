-- Every class in the timetable must be logged: what was taken, and whether homework was given.
-- Homework answered "yes" becomes an assignment (kind homework, source student) linked from the log.
alter table public.lesson_logs
  add column homework_given boolean,                                            -- null = not answered yet
  add column homework text,
  add column homework_due date,
  add column assignment_id uuid references public.assignments(id) on delete set null;
-- Existing notes were written before the homework question existed: treat them as "no homework" so history stays complete.
update public.lesson_logs set homework_given = false where homework_given is null;
