-- Wellbeing check-ins (WHO-5, weekly pulse, mindset, habits), the confidential coach chat, private coach notes and safety alerts.
create table public.wellbeing_checks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  instrument text not null check (instrument in ('pulse', 'who5', 'mindset', 'habits')),
  answers jsonb not null,
  score int,                              -- instrument-specific 0-100
  band text,                              -- green | amber | red (coarse; the only thing a parent sees)
  free_text text,                         -- "anything on your mind" (private)
  taken_on date not null,
  created_at timestamptz not null default now()
);
create index wellbeing_checks_student_idx on public.wellbeing_checks(student_id, instrument, taken_on desc);
alter table public.wellbeing_checks enable row level security;
-- Only the student sees their own answers. Parents get a coarse status computed server-side.
create policy wellbeing_student_all on public.wellbeing_checks for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  risk_level text,                        -- none | low | moderate | high (assistant-side classification of the user turn)
  created_at timestamptz not null default now()
);
create index coach_messages_student_idx on public.coach_messages(student_id, created_at desc);
alter table public.coach_messages enable row level security;
create policy coach_messages_student on public.coach_messages for select to authenticated using (student_id = auth.uid());

-- What the coach has learned about the student in confidence. Never shown to parents; only fed to the AI.
create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  note text not null,
  source text not null default 'chat',    -- chat | pulse | who5 | mindset | habits
  created_at timestamptz not null default now()
);
create index coach_notes_student_idx on public.coach_notes(student_id, created_at desc);
alter table public.coach_notes enable row level security;  -- no policies: service role only

create table public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  level text not null check (level in ('amber', 'red')),
  category text not null,                 -- self_harm | harm_by_others | substance | severe_distress | low_wellbeing | other
  summary text not null,                  -- short, no verbatim quotes
  notified boolean not null default false,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index safety_alerts_family_idx on public.safety_alerts(family_id, created_at desc);
alter table public.safety_alerts enable row level security;
create policy safety_alerts_parent on public.safety_alerts for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
