-- Co-parents: several parent accounts per family (invite links), each with their own delivery
-- channels, plus custody days so the right parent is asked the "one tap a day" questions.

-- 1. Delivery moves from the family to each parent profile.
alter table public.profiles
  add column telegram_chat_id text,
  add column whatsapp text,                       -- E.164 digits, no "+"
  add column parent_label text;                   -- "Dad", "Mum", "Baba"… shown in reports and custody

update public.profiles p
set telegram_chat_id = f.telegram_chat_id, whatsapp = f.parent_whatsapp
from public.families f
where p.family_id = f.id and p.role = 'parent'
  and p.id = (select id from public.profiles q where q.family_id = f.id and q.role = 'parent' order by created_at limit 1);

alter table public.families drop column telegram_chat_id, drop column parent_whatsapp;

-- 2. Invite links: a parent creates one, the co-parent signs up through it and lands in the same family.
create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_by uuid references public.profiles(id) on delete set null,
  label text,                                     -- who it is for, e.g. "Mum"
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index family_invites_family_idx on public.family_invites(family_id, created_at desc);
alter table public.family_invites enable row level security;
create policy family_invites_parent on public.family_invites for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

-- Signup trigger: a parent with an invite token joins that family instead of creating a new one.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  fam uuid;
  inv public.family_invites%rowtype;
  r public.user_role := coalesce((meta->>'role')::public.user_role, 'parent');
begin
  if r = 'parent' then
    if coalesce(meta->>'invite_token', '') <> '' then
      select * into inv from public.family_invites
        where token = meta->>'invite_token' and used_at is null and expires_at > now()
        for update;
      if inv.id is null then
        raise exception 'This invite link is no longer valid';
      end if;
      fam := inv.family_id;
    else
      insert into public.families (name)
        values (coalesce(meta->>'family_name', 'My family'))
        returning id into fam;
    end if;
  else
    fam := (meta->>'family_id')::uuid;
    if fam is null then
      raise exception 'student signup requires family_id in metadata';
    end if;
  end if;

  insert into public.profiles (id, family_id, role, full_name, grade, avatar_emoji, parent_label)
  values (
    new.id,
    fam,
    r,
    coalesce(meta->>'full_name', split_part(new.email, '@', 1)),
    nullif(meta->>'grade', '')::int,
    coalesce(nullif(meta->>'avatar_emoji', ''), case when r = 'parent' then '👨‍👦‍👦' else '🎓' end),
    nullif(meta->>'parent_label', '')
  );
  if inv.id is not null then
    update public.family_invites set used_by = new.id, used_at = now() where id = inv.id;
  end if;
  return new;
end;
$$;

-- 3. Custody: a weekly pattern (weekday -> parent) plus dated overrides. Null means "both / not set".
alter table public.families
  add column custody_pattern jsonb not null default '{}'::jsonb;   -- {"0": "<parent uuid>", "1": ...}

create table public.custody_overrides (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  parent_id uuid references public.profiles(id) on delete cascade,  -- null = both
  note text,
  created_at timestamptz not null default now(),
  unique (family_id, day)
);
alter table public.custody_overrides enable row level security;
create policy custody_overrides_select on public.custody_overrides for select to authenticated using (family_id = app_private.current_family_id());
create policy custody_overrides_parent_write on public.custody_overrides for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

-- Who made each tick: the report shows it and both parents can see it.
alter table public.kpi_ticks add column ticked_by uuid references public.profiles(id) on delete set null;
