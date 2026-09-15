-- Interests and favourite subjects flavour the quizzes; a third daily plan slot for the Arabic subjects.
alter table public.profiles add column interests text, add column favourite_subjects text[] not null default '{}';
alter table public.quizzes drop constraint if exists quizzes_plan_slot_check;
alter table public.quizzes add constraint quizzes_plan_slot_check check (plan_slot in ('school', 'exam', 'arabic'));

-- AI coach: periodic analysis of each child, for the parent and (in hero tone) for the child.
create table public.coach_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  headline text not null,
  parent_md text not null,
  kid_md text not null,
  data jsonb not null,            -- per-subject stats, focus areas, accelerate plan
  levels jsonb not null,          -- { subject: 'easy' | 'medium' | 'hard' } used by the planner
  model text,
  created_at timestamptz not null default now()
);
create index coach_reports_student_idx on public.coach_reports(student_id, created_at desc);
alter table public.coach_reports enable row level security;
create policy coach_reports_select on public.coach_reports for select to authenticated using (app_private.student_in_family(student_id));

-- Quran and hadith memorisation items.
create table public.memorize_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('quran', 'hadith')),
  title text not null,
  reference text,                 -- e.g. "Al-Baqarah 255" or "Sahih al-Bukhari 1"
  text_ar text not null,
  translation text,
  segments jsonb not null,        -- array of {ref, text} (ayahs) or one segment for a hadith
  best_score int,
  sessions int not null default 0,
  last_practised date,
  created_at timestamptz not null default now()
);
create index memorize_items_student_idx on public.memorize_items(student_id, created_at desc);
alter table public.memorize_items enable row level security;
create policy memorize_items_select on public.memorize_items for select to authenticated using (app_private.student_in_family(student_id));
create policy memorize_items_student_write on public.memorize_items for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
