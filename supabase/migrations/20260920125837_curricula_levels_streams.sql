-- Two curricula, and the shape each one actually has.
--
-- `topics` carried a grade and a subject and nothing else, so it could hold one school's syllabus and no more.
-- Two systems do not have the same shape: an American child moves through grades, an Egyptian one moves through
-- stages and then picks a stream, and from the second secondary year two children in the same grade study
-- different subjects. That structure has to be in the data or every page has to guess at it.

create table if not exists public.curricula (
  id          text primary key,
  name        text not null,
  name_ar     text,
  language    text not null default 'en',
  note        text,
  sort        int  not null default 0
);

-- A level is a grade, plus the stream when the grade is streamed. Two rows for Egyptian G11, three for G12.
create table if not exists public.curriculum_levels (
  id            uuid primary key default gen_random_uuid(),
  curriculum_id text not null references public.curricula(id) on delete cascade,
  grade         int  not null,
  stage         text not null,
  stream        text,
  label         text not null,
  label_ar      text,
  sort          int  not null default 0,
  unique (curriculum_id, grade, stream)
);

-- Which subjects a child at that level actually studies: what a subject list should be derived from, rather
-- than typed in by a parent who is guessing.
create table if not exists public.curriculum_subjects (
  id            uuid primary key default gen_random_uuid(),
  curriculum_id text not null references public.curricula(id) on delete cascade,
  grade         int  not null,
  stream        text,
  subject       text not null,
  subject_ar    text,
  language      text not null default 'en',
  core          boolean not null default true,
  sort          int  not null default 0,
  unique (curriculum_id, grade, stream, subject)
);

-- Topics gain the two dimensions they were missing. Nullable, so the SAT, ACT and existing school rows are
-- untouched and keep working exactly as they do.
alter table public.topics   add column if not exists curriculum_id text references public.curricula(id) on delete set null;
alter table public.topics   add column if not exists stream text;
alter table public.profiles add column if not exists curriculum_id text references public.curricula(id) on delete set null;
alter table public.profiles add column if not exists stream text;

create index if not exists topics_curriculum_idx   on public.topics (curriculum_id, grade, stream, subject, sort);
create index if not exists curriculum_levels_idx   on public.curriculum_levels (curriculum_id, grade);
create index if not exists curriculum_subjects_idx on public.curriculum_subjects (curriculum_id, grade, stream);
create index if not exists profiles_curriculum_idx on public.profiles (curriculum_id);

alter table public.curricula           enable row level security;
alter table public.curriculum_levels   enable row level security;
alter table public.curriculum_subjects enable row level security;

-- The catalogue is the same for everybody and secret from nobody: one read policy, and no per-row auth call.
drop policy if exists curricula_read on public.curricula;
create policy curricula_read on public.curricula for select to authenticated using (true);
drop policy if exists curriculum_levels_read on public.curriculum_levels;
create policy curriculum_levels_read on public.curriculum_levels for select to authenticated using (true);
drop policy if exists curriculum_subjects_read on public.curriculum_subjects;
create policy curriculum_subjects_read on public.curriculum_subjects for select to authenticated using (true);
