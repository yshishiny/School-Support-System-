-- The teacher performs the same topic at two depths, like the written lesson. Existing scripts were all written
-- at the plain level, so they keep that name and a deeper one is written beside them the first time it is asked
-- for; neither overwrites the other.
alter table public.lesson_scripts add column if not exists level text not null default 'basics';
create index if not exists lesson_scripts_topic_level_idx on public.lesson_scripts(topic_id, character_id, language, level);
