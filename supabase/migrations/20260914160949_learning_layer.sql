-- Learning layer: curriculum topics, cached lessons, AI quizzes, attempts, spaced repetition.

create type public.learning_track as enum ('school', 'act');
create type public.attempt_kind as enum ('quiz', 'review');

alter table public.profiles
  add column target_exam text,          -- e.g. 'ACT'
  add column target_exam_date date;

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade, -- null = built-in curriculum
  track public.learning_track not null default 'school',
  grade int check (grade between 1 and 12),      -- null for ACT topics
  subject text not null,
  unit text,
  name text not null,
  description text,
  act_section text,                                -- english | math | reading | science
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index topics_lookup_idx on public.topics(track, grade, subject, sort);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  grade int,
  content_md text not null,
  model text,
  created_at timestamptz not null default now(),
  unique (topic_id, grade)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  track public.learning_track not null default 'school',
  act_section text,
  title text not null,
  passage text,                                    -- shared reading passage / data description
  difficulty text not null default 'medium',
  created_at timestamptz not null default now()
);
create index quizzes_student_idx on public.quizzes(student_id, created_at desc);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null,
  prompt text not null,
  choices jsonb not null,                          -- array of 4 strings
  skill_tag text,
  unique (quiz_id, position)
);

-- Answer keys live apart from questions so students cannot read them through the API.
create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_index int not null check (correct_index between 0 and 3),
  explanation text not null
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete cascade,
  kind public.attempt_kind not null default 'quiz',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score int,
  total int,
  seconds int,
  tab_switches int not null default 0,
  flagged boolean not null default false,
  flag_reason text
);
create index attempts_student_idx on public.attempts(student_id, started_at desc);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  chosen_index int,
  correct boolean not null,
  seconds int not null default 0,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table public.review_queue (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  due_date date not null,
  interval_days int not null default 1,
  lapses int not null default 0,
  updated_at timestamptz not null default now(),
  unique (student_id, question_id)
);
create index review_due_idx on public.review_queue(student_id, due_date);

-- ---------- RLS ----------
alter table public.topics enable row level security;
alter table public.lessons enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.review_queue enable row level security;

create policy topics_select on public.topics for select to authenticated
  using (family_id is null or family_id = app_private.current_family_id());
create policy topics_parent_write on public.topics for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

create policy lessons_select on public.lessons for select to authenticated using (true);

create policy quizzes_select on public.quizzes for select to authenticated using (app_private.student_in_family(student_id));
create policy questions_select on public.quiz_questions for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and app_private.student_in_family(q.student_id)));
-- answer keys: parents may read (to review), students never; writes are service-role only
create policy keys_parent_select on public.quiz_answer_keys for select to authenticated
  using (app_private.current_role_is('parent') and exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and app_private.student_in_family(q.student_id)));

create policy attempts_select on public.attempts for select to authenticated using (app_private.student_in_family(student_id));
create policy answers_select on public.attempt_answers for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id and app_private.student_in_family(a.student_id)));
create policy review_select on public.review_queue for select to authenticated using (app_private.student_in_family(student_id));

-- ---------- built-in curriculum (American, grade 8 and grade 10) ----------
insert into public.topics (track, grade, subject, unit, name, sort) values
-- Grade 8 Math (Common Core 8 / Pre-Algebra)
('school', 8, 'Math', 'Number System', 'Rational and irrational numbers, square and cube roots', 1),
('school', 8, 'Math', 'Expressions & Equations', 'Exponent rules and scientific notation', 2),
('school', 8, 'Math', 'Expressions & Equations', 'Proportional relationships and slope', 3),
('school', 8, 'Math', 'Expressions & Equations', 'Solving linear equations in one variable', 4),
('school', 8, 'Math', 'Functions', 'Linear functions and graphing y = mx + b', 5),
('school', 8, 'Math', 'Expressions & Equations', 'Systems of linear equations', 6),
('school', 8, 'Math', 'Functions', 'Functions: tables, graphs, and comparing rates', 7),
('school', 8, 'Math', 'Geometry', 'Transformations: translations, reflections, rotations, dilations', 8),
('school', 8, 'Math', 'Geometry', 'Angles, parallel lines, and triangle angle sums', 9),
('school', 8, 'Math', 'Geometry', 'Pythagorean theorem and distance', 10),
('school', 8, 'Math', 'Geometry', 'Volume of cylinders, cones, and spheres', 11),
('school', 8, 'Math', 'Statistics', 'Scatter plots, lines of best fit, and two-way tables', 12),
-- Grade 8 Science (integrated / physical science)
('school', 8, 'Science', 'Matter', 'Atoms, elements, and the periodic table', 1),
('school', 8, 'Science', 'Matter', 'Chemical reactions and conservation of mass', 2),
('school', 8, 'Science', 'Physics', 'Forces, motion, and Newton''s laws', 3),
('school', 8, 'Science', 'Physics', 'Energy: kinetic, potential, and transfer', 4),
('school', 8, 'Science', 'Physics', 'Waves: sound, light, and the electromagnetic spectrum', 5),
('school', 8, 'Science', 'Physics', 'Electricity and magnetism', 6),
('school', 8, 'Science', 'Earth & Space', 'Plate tectonics and Earth''s systems', 7),
('school', 8, 'Science', 'Earth & Space', 'The solar system, gravity, and seasons', 8),
('school', 8, 'Science', 'Life Science', 'Cells and body systems', 9),
('school', 8, 'Science', 'Life Science', 'Genetics and heredity', 10),
('school', 8, 'Science', 'Life Science', 'Ecosystems and natural selection', 11),
-- Grade 8 English
('school', 8, 'English', 'Reading', 'Literature: theme, character, and point of view', 1),
('school', 8, 'English', 'Reading', 'Informational text: central idea, structure, author''s purpose', 2),
('school', 8, 'English', 'Language', 'Vocabulary: context clues, roots, connotation', 3),
('school', 8, 'English', 'Language', 'Grammar: verbals, active and passive voice, verb moods', 4),
('school', 8, 'English', 'Language', 'Punctuation and sentence structure', 5),
('school', 8, 'English', 'Writing', 'Argumentative writing: claims, evidence, counterclaims', 6),
('school', 8, 'English', 'Writing', 'Informative and explanatory writing', 7),
('school', 8, 'English', 'Writing', 'Narrative writing techniques', 8),
-- Grade 8 Social Studies (US History)
('school', 8, 'Social Studies', 'US History', 'Colonial America and the road to revolution', 1),
('school', 8, 'Social Studies', 'US History', 'The American Revolution', 2),
('school', 8, 'Social Studies', 'US History', 'The Constitution and the Bill of Rights', 3),
('school', 8, 'Social Studies', 'US History', 'Early republic and westward expansion', 4),
('school', 8, 'Social Studies', 'US History', 'Civil War and Reconstruction', 5),
('school', 8, 'Social Studies', 'US History', 'Industrialization and immigration', 6),
-- Grade 10 Math (Geometry, with Algebra 2 preview)
('school', 10, 'Math', 'Geometry', 'Geometric reasoning and proofs', 1),
('school', 10, 'Math', 'Geometry', 'Parallel and perpendicular lines', 2),
('school', 10, 'Math', 'Geometry', 'Triangle congruence', 3),
('school', 10, 'Math', 'Geometry', 'Triangle similarity and proportions', 4),
('school', 10, 'Math', 'Geometry', 'Right triangles and trigonometry', 5),
('school', 10, 'Math', 'Geometry', 'Quadrilaterals and polygons', 6),
('school', 10, 'Math', 'Geometry', 'Circles: arcs, chords, tangents, and angles', 7),
('school', 10, 'Math', 'Geometry', 'Area, surface area, and volume', 8),
('school', 10, 'Math', 'Geometry', 'Coordinate geometry', 9),
('school', 10, 'Math', 'Geometry', 'Probability and counting', 10),
('school', 10, 'Math', 'Algebra 2', 'Quadratics: factoring, formula, and vertex form', 11),
('school', 10, 'Math', 'Algebra 2', 'Polynomials and rational expressions', 12),
('school', 10, 'Math', 'Algebra 2', 'Exponential and logarithmic functions', 13),
-- Grade 10 Science (Chemistry, with Biology review)
('school', 10, 'Science', 'Chemistry', 'Atomic structure and electron configuration', 1),
('school', 10, 'Science', 'Chemistry', 'Periodic trends', 2),
('school', 10, 'Science', 'Chemistry', 'Ionic and covalent bonding; naming compounds', 3),
('school', 10, 'Science', 'Chemistry', 'The mole and stoichiometry', 4),
('school', 10, 'Science', 'Chemistry', 'Types of reactions and balancing equations', 5),
('school', 10, 'Science', 'Chemistry', 'Gas laws', 6),
('school', 10, 'Science', 'Chemistry', 'Solutions, acids, and bases', 7),
('school', 10, 'Science', 'Chemistry', 'Thermochemistry basics', 8),
('school', 10, 'Science', 'Biology', 'Cells, DNA, and protein synthesis', 9),
('school', 10, 'Science', 'Biology', 'Genetics and inheritance', 10),
('school', 10, 'Science', 'Biology', 'Evolution and ecology', 11),
-- Grade 10 English (World Literature)
('school', 10, 'English', 'Reading', 'Analyzing theme and complex characters', 1),
('school', 10, 'English', 'Reading', 'Author''s choices: structure, tone, and irony', 2),
('school', 10, 'English', 'Reading', 'Rhetoric: ethos, pathos, logos', 3),
('school', 10, 'English', 'Reading', 'Evaluating arguments in informational text', 4),
('school', 10, 'English', 'Language', 'Academic vocabulary and Greek/Latin roots', 5),
('school', 10, 'English', 'Language', 'Grammar: parallel structure, clauses, semicolons and colons', 6),
('school', 10, 'English', 'Writing', 'Argumentative essay', 7),
('school', 10, 'English', 'Writing', 'Literary analysis essay', 8),
('school', 10, 'English', 'Writing', 'Research and citations', 9),
-- Grade 10 Social Studies (World History)
('school', 10, 'Social Studies', 'World History', 'Renaissance and Reformation', 1),
('school', 10, 'Social Studies', 'World History', 'Age of Exploration and empires', 2),
('school', 10, 'Social Studies', 'World History', 'Enlightenment and the American and French Revolutions', 3),
('school', 10, 'Social Studies', 'World History', 'The Industrial Revolution', 4),
('school', 10, 'Social Studies', 'World History', 'Imperialism and nationalism', 5),
('school', 10, 'Social Studies', 'World History', 'World War I', 6),
('school', 10, 'Social Studies', 'World History', 'World War II and the Holocaust', 7),
('school', 10, 'Social Studies', 'World History', 'The Cold War and decolonization', 8),
('school', 10, 'Social Studies', 'World History', 'The modern Middle East and globalization', 9);

-- ACT track (enhanced ACT, 2025 onwards)
insert into public.topics (track, subject, act_section, unit, name, description, sort) values
('act', 'ACT English', 'english', 'Conventions of Standard English', 'Punctuation: commas, apostrophes, semicolons, dashes', '50 questions, 35 minutes', 1),
('act', 'ACT English', 'english', 'Conventions of Standard English', 'Sentence structure, fragments, and run-ons', null, 2),
('act', 'ACT English', 'english', 'Conventions of Standard English', 'Usage: agreement, pronouns, verb tense, modifiers', null, 3),
('act', 'ACT English', 'english', 'Knowledge of Language', 'Concision, precision, and style', null, 4),
('act', 'ACT English', 'english', 'Production of Writing', 'Topic development, organization, and transitions', null, 5),
('act', 'ACT Math', 'math', 'Preparing for Higher Math', 'Number and quantity: ratios, percents, exponents, radicals', '45 questions, 50 minutes', 1),
('act', 'ACT Math', 'math', 'Preparing for Higher Math', 'Algebra: linear equations, inequalities, systems', null, 2),
('act', 'ACT Math', 'math', 'Preparing for Higher Math', 'Functions: linear, quadratic, exponential, graphs', null, 3),
('act', 'ACT Math', 'math', 'Preparing for Higher Math', 'Geometry: angles, triangles, circles, area and volume', null, 4),
('act', 'ACT Math', 'math', 'Preparing for Higher Math', 'Statistics and probability', null, 5),
('act', 'ACT Math', 'math', 'Integrating Essential Skills', 'Word problems, rates, and multi-step reasoning', null, 6),
('act', 'ACT Reading', 'reading', 'Key Ideas and Details', 'Main idea, details, and inference', '36 questions, 40 minutes', 1),
('act', 'ACT Reading', 'reading', 'Craft and Structure', 'Word meaning in context, tone, and structure', null, 2),
('act', 'ACT Reading', 'reading', 'Integration of Knowledge', 'Evidence, argument, and comparing passages', null, 3),
('act', 'ACT Science', 'science', 'Interpretation of Data', 'Reading graphs, tables, and trends', 'Optional section, 40 questions, 40 minutes', 1),
('act', 'ACT Science', 'science', 'Scientific Investigation', 'Experimental design, variables, and controls', null, 2),
('act', 'ACT Science', 'science', 'Evaluation of Models', 'Conflicting viewpoints and evaluating conclusions', null, 3);
