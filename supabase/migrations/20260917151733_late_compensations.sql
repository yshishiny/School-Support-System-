-- A late entry (a past prayer, a check-in filled in later) is balanced by reading two ayahs and answering one question right.
create table public.late_compensations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('prayer','checkin','classlog')),
  ref text not null,                     -- 'prayer:2026-09-15:isha' or 'checkin:2026-09-15'
  label text not null,
  verses jsonb not null default '[]'::jsonb,   -- [{ref, text, translation}]
  question jsonb not null,               -- {prompt, choices[], correct}
  read_at timestamptz,
  answered_at timestamptz,
  correct boolean,
  attempts int not null default 0,
  created_at timestamptz not null default now()
  , unique (student_id, ref)
);
create index late_compensations_student_idx on public.late_compensations(student_id, created_at desc);
alter table public.late_compensations enable row level security;
create policy late_compensations_family_select on public.late_compensations for select to authenticated using (app_private.student_in_family(student_id));
