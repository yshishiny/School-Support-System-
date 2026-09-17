-- Follow-up questions for the child on each integrity signal: asked up to three times, differently, over several days.
create table public.integrity_followups (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  signal_key text not null,          -- code + week start, one thread per signal per week
  signal_code text not null,
  signal_label text not null,
  round int not null check (round between 1 and 3),
  question text not null,
  asked_on date not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, signal_key, round)
);
create index integrity_followups_student_idx on public.integrity_followups(student_id, asked_on desc);
alter table public.integrity_followups enable row level security;
create policy integrity_followups_family_select on public.integrity_followups for select to authenticated using (app_private.student_in_family(student_id));
create policy integrity_followups_student_answer on public.integrity_followups for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
