-- Kids Study Portal: initial schema
-- Applies to Supabase Postgres. Everything is scoped to a "family".

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type public.user_role as enum ('parent', 'student');
create type public.assignment_kind as enum ('homework', 'quiz', 'exam', 'project', 'event', 'note');
create type public.assignment_source as enum ('manual', 'whatsapp', 'student');
create type public.assignment_status as enum ('open', 'done', 'missed');
create type public.item_status as enum ('done', 'partial', 'not_done');
create type public.reward_kind as enum ('cash', 'privilege', 'item');
create type public.redemption_status as enum ('pending', 'approved', 'rejected', 'delivered');
create type public.report_status as enum ('pending', 'sent', 'failed');

-- ---------- core tables ----------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_whatsapp text,               -- E.164 without "+", e.g. 2010xxxxxxx
  timezone text not null default 'Africa/Cairo',
  report_hour int not null default 20 check (report_hour between 0 and 23),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role public.user_role not null,
  full_name text not null,
  grade int check (grade between 1 and 12),
  avatar_emoji text not null default '🎓',
  locale text not null default 'en',
  created_at timestamptz not null default now()
);
create index profiles_family_idx on public.profiles(family_id);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  teacher text,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (student_id, name)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  subject_name text,                  -- free text when no subject row matched
  kind public.assignment_kind not null default 'homework',
  title text not null,
  details text,
  due_date date,
  source public.assignment_source not null default 'manual',
  source_excerpt text,                -- original WhatsApp message, for reference
  status public.assignment_status not null default 'open',
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index assignments_student_due_idx on public.assignments(student_id, due_date);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time,
  subject_name text not null,
  room text,
  created_at timestamptz not null default now()
);
create index timetable_student_idx on public.timetable_entries(student_id, weekday);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null,
  mood int check (mood between 1 and 5),
  minutes_studied int not null default 0 check (minutes_studied >= 0),
  learned text,                       -- "what I learned today"
  stuck_on text,                      -- "what I did not understand"
  submitted_at timestamptz not null default now(),
  unique (student_id, checkin_date)
);

create table public.checkin_items (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  status public.item_status not null,
  note text,
  unique (checkin_id, assignment_id)
);

create table public.whatsapp_imports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  filename text,
  message_count int not null default 0,
  items_found int not null default 0,
  items_added int not null default 0,
  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz not null default now()
);

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  reason text not null,
  ref_type text,                      -- 'checkin' | 'assignment' | 'streak' | 'redemption' | 'manual'
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index points_student_idx on public.points_ledger(student_id, created_at desc);
-- one award per (student, ref_type, ref_id) so a re-submitted check-in never double pays
create unique index points_unique_ref_idx on public.points_ledger(student_id, ref_type, ref_id) where ref_id is not null;

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  description text,
  kind public.reward_kind not null default 'privilege',
  cost_points int not null check (cost_points > 0),
  cash_amount_egp numeric(10,2),
  emoji text not null default '🎁',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  points_spent int not null,
  status public.redemption_status not null default 'pending',
  note text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  report_date date not null,
  body text not null,
  channel text not null default 'none',
  status public.report_status not null default 'pending',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, report_date)
);

-- ---------- helper functions (security definer so RLS policies can call them cheaply) ----------
create or replace function public.current_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role_is(r public.user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = r)
$$;

create or replace function public.student_in_family(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = sid and p.family_id = public.current_family_id()
  )
$$;

create or replace function public.student_points(sid uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.points_ledger where student_id = sid
$$;

-- ---------- new-user trigger: create family + profile from signup metadata ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  fam uuid;
  r public.user_role := coalesce((meta->>'role')::public.user_role, 'parent');
begin
  if r = 'parent' then
    insert into public.families (name)
      values (coalesce(meta->>'family_name', 'My family'))
      returning id into fam;
  else
    fam := (meta->>'family_id')::uuid;
    if fam is null then
      raise exception 'student signup requires family_id in metadata';
    end if;
  end if;

  insert into public.profiles (id, family_id, role, full_name, grade, avatar_emoji)
  values (
    new.id,
    fam,
    r,
    coalesce(meta->>'full_name', split_part(new.email, '@', 1)),
    nullif(meta->>'grade', '')::int,
    coalesce(nullif(meta->>'avatar_emoji', ''), case when r = 'parent' then '👨‍👦‍👦' else '🎓' end)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- row level security ----------
alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.assignments enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_items enable row level security;
alter table public.whatsapp_imports enable row level security;
alter table public.points_ledger enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.daily_reports enable row level security;

-- families: everyone in the family can read; only parents update
create policy families_select on public.families for select using (id = public.current_family_id());
create policy families_update on public.families for update using (id = public.current_family_id() and public.current_role_is('parent'));

-- profiles: family can read each other; users update themselves; parents update children
create policy profiles_select on public.profiles for select using (family_id = public.current_family_id());
create policy profiles_update_self on public.profiles for update using (id = auth.uid());
create policy profiles_update_parent on public.profiles for update using (family_id = public.current_family_id() and public.current_role_is('parent'));

-- subjects
create policy subjects_select on public.subjects for select using (public.student_in_family(student_id));
create policy subjects_write on public.subjects for all
  using (public.student_in_family(student_id) and (public.current_role_is('parent') or student_id = auth.uid()))
  with check (public.student_in_family(student_id) and (public.current_role_is('parent') or student_id = auth.uid()));

-- assignments: family reads; parent full; student may add own (source=student) and mark own done
create policy assignments_select on public.assignments for select using (public.student_in_family(student_id));
create policy assignments_parent_all on public.assignments for all
  using (public.student_in_family(student_id) and public.current_role_is('parent'))
  with check (public.student_in_family(student_id) and public.current_role_is('parent'));
create policy assignments_student_insert on public.assignments for insert
  with check (student_id = auth.uid() and source = 'student');
create policy assignments_student_update on public.assignments for update
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- timetable
create policy timetable_select on public.timetable_entries for select using (public.student_in_family(student_id));
create policy timetable_write on public.timetable_entries for all
  using (public.student_in_family(student_id) and (public.current_role_is('parent') or student_id = auth.uid()))
  with check (public.student_in_family(student_id) and (public.current_role_is('parent') or student_id = auth.uid()));

-- checkins: family reads; student writes own
create policy checkins_select on public.checkins for select using (public.student_in_family(student_id));
create policy checkins_student_write on public.checkins for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy checkin_items_select on public.checkin_items for select
  using (exists (select 1 from public.checkins c where c.id = checkin_id and public.student_in_family(c.student_id)));
create policy checkin_items_student_write on public.checkin_items for all
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.student_id = auth.uid()))
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.student_id = auth.uid()));

-- whatsapp imports: parent only
create policy imports_parent on public.whatsapp_imports for all
  using (family_id = public.current_family_id() and public.current_role_is('parent'))
  with check (family_id = public.current_family_id() and public.current_role_is('parent'));

-- points: family reads; parent may adjust manually; automatic awards are written server-side (service role)
create policy points_select on public.points_ledger for select using (public.student_in_family(student_id));
create policy points_parent_insert on public.points_ledger for insert
  with check (public.student_in_family(student_id) and public.current_role_is('parent'));

-- rewards: family reads active; parent manages
create policy rewards_select on public.rewards for select using (family_id = public.current_family_id());
create policy rewards_parent_all on public.rewards for all
  using (family_id = public.current_family_id() and public.current_role_is('parent'))
  with check (family_id = public.current_family_id() and public.current_role_is('parent'));

-- redemptions: student requests own; parent decides
create policy redemptions_select on public.redemptions for select using (public.student_in_family(student_id));
create policy redemptions_student_insert on public.redemptions for insert with check (student_id = auth.uid());
create policy redemptions_parent_update on public.redemptions for update
  using (public.student_in_family(student_id) and public.current_role_is('parent'));

-- daily reports: parent only
create policy reports_parent on public.daily_reports for all
  using (family_id = public.current_family_id() and public.current_role_is('parent'))
  with check (family_id = public.current_family_id() and public.current_role_is('parent'));
