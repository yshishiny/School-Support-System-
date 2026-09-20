-- The same topic, taught at two depths. A lesson used to be unique per topic and grade, which meant one
-- treatment for a child who missed the class and a child who already has it. Now the level is part of the key,
-- so both can exist side by side and neither overwrites the other.
alter table public.lessons add column if not exists level text not null default 'basics';
alter table public.lessons drop constraint if exists lessons_topic_id_grade_key;
create unique index if not exists lessons_topic_grade_level_key on public.lessons(topic_id, grade, level);
