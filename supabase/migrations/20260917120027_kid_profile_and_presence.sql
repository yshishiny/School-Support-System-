-- Richer child profile (birthday, stage of life, school, notes for the coach) and live presence for the parent.
alter table public.profiles
  add column birth_date date,
  add column stage text not null default 'school' check (stage in ('school', 'university', 'postgraduate', 'adult')),
  add column gender text check (gender in ('boy', 'girl', 'other')),
  add column school_name text,
  add column phone text,
  add column parent_notes text,                 -- what the parent wants the coach to know (strengths, health, sensitivities)
  add column last_seen_at timestamptz,          -- presence: updated at most every two minutes while the app is open
  add column last_path text,
  add column live_pings boolean not null default true;  -- parents: instant browser pings when a child finishes something
create index profiles_last_seen_idx on public.profiles(family_id, last_seen_at desc);
