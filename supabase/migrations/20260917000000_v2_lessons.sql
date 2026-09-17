-- V2 (beta): virtual teachers. Additive only: new tables plus one nullable column on profiles.
create table public.lesson_scripts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics(id) on delete cascade,
  material_id uuid references public.materials(id) on delete cascade,
  character_id text not null,
  language text not null default 'en',
  grade int,
  title text not null,
  minutes int not null default 12,
  script jsonb not null,                       -- { beats: [...], quiz: [...] }
  model text,
  version int not null default 1,
  flagged_at timestamptz,                      -- a parent flagged a wrong fact; regenerate on the best model
  created_at timestamptz not null default now()
);
create index lesson_scripts_topic_idx on public.lesson_scripts(topic_id, character_id, language);
create index lesson_scripts_material_idx on public.lesson_scripts(material_id, character_id, language);
alter table public.lesson_scripts enable row level security;
create policy lesson_scripts_read on public.lesson_scripts for select to authenticated using (true);

create table public.lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  script_id uuid not null references public.lesson_scripts(id) on delete cascade,
  character_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  beat_index int not null default 0,
  checks jsonb not null default '[]'::jsonb,   -- [{beat, correct, attempts}]
  understanding text check (understanding in ('understood', 'shaky', 'lost')),
  quiz_id uuid references public.quizzes(id) on delete set null,
  seconds int
);
create index lesson_sessions_student_idx on public.lesson_sessions(student_id, started_at desc);
alter table public.lesson_sessions enable row level security;
create policy lesson_sessions_family_select on public.lesson_sessions for select to authenticated using (app_private.student_in_family(student_id));
create policy lesson_sessions_student_write on public.lesson_sessions for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

create table public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  beat_index int not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);
alter table public.lesson_questions enable row level security;
create policy lesson_questions_family_select on public.lesson_questions for select to authenticated using (app_private.student_in_family(student_id));

alter table public.profiles add column character_id text;   -- the child's chosen teacher (null = not chosen yet)
