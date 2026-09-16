-- Reminders ("nudges") for the kids on Telegram: what to do today, check-in time, last call. One row per nudge per day so nothing is sent twice.
alter table public.profiles add column nudges jsonb not null default '{"morning": true, "evening": true, "lastcall": true, "prayers": false}'::jsonb;

create table public.nudges_sent (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  code text not null,
  sent_at timestamptz not null default now(),
  unique (student_id, day, code)
);
alter table public.nudges_sent enable row level security;  -- service role only
