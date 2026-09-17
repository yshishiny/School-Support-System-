-- Manners: the child rates himself first at check-in; the parent confirms with the daily tick.
alter table public.checkins add column manners_self int check (manners_self between 1 and 5);
alter table public.checkins add column manners_note text;

-- Monthly revision per subject, built from the month's school files: a sheet to read and a quiz to sit.
create table public.revision_sheets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  month date not null,                 -- first day of the month
  subject text not null,
  material_ids uuid[] not null default '{}',
  content_md text,
  quiz_id uuid references public.quizzes(id) on delete set null,
  status text not null default 'new' check (status in ('new','ready','failed')),
  error text,
  model text,
  created_at timestamptz not null default now(),
  unique (student_id, month, subject)
);
create index revision_sheets_student_idx on public.revision_sheets(student_id, month desc);
alter table public.revision_sheets enable row level security;
create policy revision_sheets_family_select on public.revision_sheets for select to authenticated using (app_private.student_in_family(student_id));
