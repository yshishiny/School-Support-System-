-- The school's own topics join the American curriculum.
--
-- The catalogue was added after the app already had topics. The first 160 school topics were never tagged
-- with a curriculum, and everything anybody had prepared hung off them. Once both boys were set to the
-- American curriculum, `topicsFor` began answering with the seeded Common Core list instead — and that list
-- has never had a single lesson, quiz, script, media set or log against it. 157 pieces of prepared
-- teaching became unreachable without one row changing.
--
-- This runs the fold in the only safe direction. The school's row is the one that survives, keeping its id, so
-- no lesson, quiz or media set is re-pointed and none can land on the wrong topic. A seeded row the school's
-- own topic already covers is dropped, because it holds nothing and a child does not need two versions of his
-- own syllabus. A seeded row the school does not reach stays: that is coverage, not clutter.
--
-- Which pairs count as "already covered" was decided by the gap matcher and then read, pair by pair. Three
-- were wrong and are refused in lib/curriculum/fold.ts — most importantly "World War I" against "The Second
-- World War", which the matcher scored 1.00 because it drops one-character tokens and the roman numeral is the
-- entire difference between the two wars.
--
-- Afterwards:
--   Grade 8: Arabic 14, Arabic Social Studies 11, Computer Science 14, English Language Arts 24, Mathematics 24, Religion 10, Science 24, Social Studies 16
--   Grade 10: Algebra II 3, Arabic 16, Arabic Social Studies 10, Biology 10, Chemistry 35, Computer Science 11, English 10 26, Geometry 37, Physics 11, Religion 10, World History II 19
--
-- Reversible: every row this touches is copied to curriculum_fold_backup_2026_09 first.

-- 1. The undo copy. Service-role only; nothing in the app reads it.
create table if not exists public.curriculum_fold_backup_2026_09 (
  id            bigserial primary key,
  action        text not null check (action in ('moved', 'dropped')),
  topic_id      uuid not null,
  curriculum_id text,
  grade         int,
  subject       text,
  unit          text,
  name          text,
  sort          int,
  language      text,
  taken_at      timestamptz not null default now()
);
alter table public.curriculum_fold_backup_2026_09 enable row level security;

-- 2. Copy the 160 school topics, then the 36 seeded rows about to go.
insert into public.curriculum_fold_backup_2026_09 (action, topic_id, curriculum_id, grade, subject, unit, name, sort, language)
select 'moved', id, curriculum_id, grade, subject, unit, name, sort, language
from public.topics
where curriculum_id is null and track = 'school';

insert into public.curriculum_fold_backup_2026_09 (action, topic_id, curriculum_id, grade, subject, unit, name, sort, language)
select 'dropped', t.id, t.curriculum_id, t.grade, t.subject, t.unit, t.name, t.sort, t.language
from public.topics t
join (values
  (10, 'English 10', 'Argumentative essay with cohesion'),
  (10, 'Geometry', 'Parallel lines and transversals'),
  (10, 'Geometry', 'Right triangle trigonometry'),
  (10, 'Geometry', 'Similar polygons and triangle similarity'),
  (10, 'Geometry', 'Special right triangles'),
  (10, 'Geometry', 'Surface area of solids'),
  (10, 'Geometry', 'Tangents, arcs and chords'),
  (10, 'World History II', 'American and French revolutions'),
  (10, 'World History II', 'Causes and course of the First World War'),
  (10, 'World History II', 'The Cold War'),
  (10, 'World History II', 'The Holocaust'),
  (10, 'World History II', 'The Industrial Revolution'),
  (10, 'World History II', 'The Second World War'),
  (8, 'English Language Arts', 'Active and passive voice'),
  (8, 'English Language Arts', 'Informative writing with precise language'),
  (8, 'English Language Arts', 'Verb mood and shifts'),
  (8, 'Mathematics', 'Approximating irrational numbers'),
  (8, 'Mathematics', 'Converse of the Pythagorean theorem'),
  (8, 'Mathematics', 'Linear equations with one, none or many solutions'),
  (8, 'Mathematics', 'Lines of best fit'),
  (8, 'Mathematics', 'Rational and irrational numbers'),
  (8, 'Mathematics', 'Scatter plots and association'),
  (8, 'Mathematics', 'Scientific notation'),
  (8, 'Mathematics', 'Square roots and cube roots'),
  (8, 'Mathematics', 'Systems of linear equations graphically'),
  (8, 'Mathematics', 'The Pythagorean theorem'),
  (8, 'Mathematics', 'Transformations: translations, reflections, rotations'),
  (8, 'Mathematics', 'Two-way tables'),
  (8, 'Mathematics', 'Volume of cones, cylinders and spheres'),
  (8, 'Science', 'Light and the electromagnetic spectrum'),
  (8, 'Science', 'Natural selection'),
  (8, 'Science', 'Sound waves'),
  (8, 'Social Studies', 'Causes of the American Revolution'),
  (8, 'Social Studies', 'Causes of the Civil War'),
  (8, 'Social Studies', 'Colonial America'),
  (8, 'Social Studies', 'The Bill of Rights')
) as d(grade, subject, name) on d.grade = t.grade and d.subject = t.subject and d.name = t.name
where t.curriculum_id = 'american';

-- 3. Drop the covered seeded rows.
--
-- Scoped to curriculum_id = 'american' and run before the move, on purpose: afterwards a school topic named
-- "The Industrial Revolution" would sit in World History II beside the seeded one of the same name, and an
-- unscoped delete would take the school's row and its lesson with it.
delete from public.topics t
using (values
  (10, 'English 10', 'Argumentative essay with cohesion'),
  (10, 'Geometry', 'Parallel lines and transversals'),
  (10, 'Geometry', 'Right triangle trigonometry'),
  (10, 'Geometry', 'Similar polygons and triangle similarity'),
  (10, 'Geometry', 'Special right triangles'),
  (10, 'Geometry', 'Surface area of solids'),
  (10, 'Geometry', 'Tangents, arcs and chords'),
  (10, 'World History II', 'American and French revolutions'),
  (10, 'World History II', 'Causes and course of the First World War'),
  (10, 'World History II', 'The Cold War'),
  (10, 'World History II', 'The Holocaust'),
  (10, 'World History II', 'The Industrial Revolution'),
  (10, 'World History II', 'The Second World War'),
  (8, 'English Language Arts', 'Active and passive voice'),
  (8, 'English Language Arts', 'Informative writing with precise language'),
  (8, 'English Language Arts', 'Verb mood and shifts'),
  (8, 'Mathematics', 'Approximating irrational numbers'),
  (8, 'Mathematics', 'Converse of the Pythagorean theorem'),
  (8, 'Mathematics', 'Linear equations with one, none or many solutions'),
  (8, 'Mathematics', 'Lines of best fit'),
  (8, 'Mathematics', 'Rational and irrational numbers'),
  (8, 'Mathematics', 'Scatter plots and association'),
  (8, 'Mathematics', 'Scientific notation'),
  (8, 'Mathematics', 'Square roots and cube roots'),
  (8, 'Mathematics', 'Systems of linear equations graphically'),
  (8, 'Mathematics', 'The Pythagorean theorem'),
  (8, 'Mathematics', 'Transformations: translations, reflections, rotations'),
  (8, 'Mathematics', 'Two-way tables'),
  (8, 'Mathematics', 'Volume of cones, cylinders and spheres'),
  (8, 'Science', 'Light and the electromagnetic spectrum'),
  (8, 'Science', 'Natural selection'),
  (8, 'Science', 'Sound waves'),
  (8, 'Social Studies', 'Causes of the American Revolution'),
  (8, 'Social Studies', 'Causes of the Civil War'),
  (8, 'Social Studies', 'Colonial America'),
  (8, 'Social Studies', 'The Bill of Rights')
) as d(grade, subject, name)
where t.curriculum_id = 'american' and t.grade = d.grade and t.subject = d.subject and t.name = d.name;

-- 4. Bring the school's topics in, renamed to the subject the American list uses and sorted ahead of it.
--
-- The two mapping tables are the ones in lib/curriculum/fold.ts. A subject is renamed per grade, because the
-- same school subject has different American names in different years: "Math" is Mathematics in grade 8 and
-- Geometry in grade 10. The unit table overrides the subject one where the school's own unit is the truer
-- label — grade 10 "Math" is ten geometry topics and three algebra ones, and quadratics are not geometry.
--
-- Numbering restarts at 1 per subject. The seeded sorts start at 101, so this puts the term's actual syllabus
-- at the top and the catalogue below it, rather than making a child scroll past twenty-seven Common Core
-- headings he has never been taught to reach the ten his teacher set.
update public.topics t
set curriculum_id = 'american', subject = f.new_subject, sort = f.new_sort
from (
  select
    s.id,
    coalesce(u.new_subject, m.new_subject, s.subject) as new_subject,
    row_number() over (
      partition by s.grade, coalesce(u.new_subject, m.new_subject, s.subject)
      order by s.sort, s.name
    ) as new_sort
  from public.topics s
  left join (values
  (10, 'Math', 'Algebra 2', 'Algebra II')
  ) as u(grade, subject, unit, new_subject)
    on u.grade = s.grade and u.subject = s.subject and u.unit = s.unit
  left join (values
  (8, 'Math', 'Mathematics'),
  (8, 'English', 'English Language Arts'),
  (8, 'Science', 'Science'),
  (8, 'Social Studies', 'Social Studies'),
  (10, 'Math', 'Geometry'),
  (10, 'English', 'English 10'),
  (10, 'Social Studies', 'World History II')
  ) as m(grade, subject, new_subject)
    on m.grade = s.grade and m.subject = s.subject
  where s.curriculum_id is null and s.track = 'school'
) as f
where t.id = f.id;

-- 5. The subjects the American catalogue was missing.
--
-- An American-diploma school in Egypt still teaches Arabic, Arabic Social Studies and Religion to the national
-- syllabus, and this one teaches Biology and Physics in grade 10 where Common Core has only Chemistry. Without
-- these rows a parent's subject list would keep disagreeing with the child's timetable.
insert into public.curriculum_subjects (curriculum_id, grade, stream, subject, subject_ar, language, core, sort)
values
  ('american', 8, null, 'Arabic', 'اللغة العربية', 'ar', true, 5),
  ('american', 8, null, 'Arabic Social Studies', 'الدراسات الاجتماعية', 'ar', true, 6),
  ('american', 8, null, 'Religion', 'التربية الدينية الإسلامية', 'ar', true, 7),
  ('american', 10, null, 'Algebra II', null, 'en', true, 2),
  ('american', 10, null, 'Arabic', 'اللغة العربية', 'ar', true, 8),
  ('american', 10, null, 'Arabic Social Studies', 'الدراسات الاجتماعية', 'ar', true, 9),
  ('american', 10, null, 'Biology', null, 'en', true, 4),
  ('american', 10, null, 'Physics', null, 'en', true, 5),
  ('american', 10, null, 'Religion', 'التربية الدينية الإسلامية', 'ar', true, 10)
on conflict (curriculum_id, grade, stream, subject) do nothing;

-- The seeded rows were numbered before any of those existed, so they move down to make room. Without this a
-- parent reads Mathematics, Science, English, Social Studies, Computer Science, Art, PE — and then Arabic.
update public.curriculum_subjects c
set sort = r.sort
from (values
  (8, 'Computer Science', 8),
  (8, 'Art', 9),
  (8, 'Physical Education', 10),
  (10, 'Chemistry', 3),
  (10, 'English 10', 6),
  (10, 'World History II', 7),
  (10, 'Computer Science', 11)
) as r(grade, subject, sort)
where c.curriculum_id = 'american' and c.stream is null and c.grade = r.grade and c.subject = r.subject;

-- 6. Refuse to finish in a half-folded state.
do $$
declare stragglers int; unreachable int;
begin
  select count(*) into stragglers from public.topics where curriculum_id is null and track = 'school';
  if stragglers <> 0 then
    raise exception 'fold left % school topics with no curriculum', stragglers;
  end if;

  select count(*) into unreachable
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  where t.curriculum_id is null;
  if unreachable <> 0 then
    raise exception 'fold left % lessons on untagged topics', unreachable;
  end if;
end $$;
