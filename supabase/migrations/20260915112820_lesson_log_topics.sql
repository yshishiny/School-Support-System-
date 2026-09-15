-- Lesson notes can point at a curriculum topic, so the weekly plan can quiz what was actually taught.
alter table public.lesson_logs add column topic_id uuid references public.topics(id) on delete set null;
create index lesson_logs_topic_idx on public.lesson_logs(student_id, topic_id) where topic_id is not null;
