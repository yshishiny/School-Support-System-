-- A child's own second (and third) explanation of a lesson he did not understand.
--
-- A lesson is cached per (topic, grade, level) and shared by every child in that year, so rewriting it because
-- one child said "I don't get it" would silently change it under his brother. A re-teach is personal: it
-- belongs to the child who asked, in the way he asked for it, and it never touches the shared lesson.
--
-- The style is kept as a column rather than baked into the text so a child can ask the same topic three
-- different ways and keep all three.
create table if not exists lesson_retakes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  level text not null default 'basics',
  style text not null check (style in ('simpler', 'examples', 'different')),
  content_md text not null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists lesson_retakes_for_child_idx
  on lesson_retakes (student_id, topic_id, created_at desc);

alter table lesson_retakes enable row level security;

create policy lesson_retakes_own on lesson_retakes
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy lesson_retakes_parent_read on lesson_retakes
  for select to authenticated
  using (exists (
    select 1 from profiles me, profiles kid
    where me.id = auth.uid() and me.role = 'parent'
      and kid.id = lesson_retakes.student_id and kid.family_id = me.family_id
  ));
