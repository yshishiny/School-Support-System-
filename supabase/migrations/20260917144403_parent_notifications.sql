-- In-app inbox for parents: every report, alert, allowance note, school news and live ping is kept here too.
create table public.parent_notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'info' check (kind in ('report','alert','allowance','news','ping','info')),
  title text not null,
  body text not null default '',
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index parent_notifications_parent_idx on public.parent_notifications(parent_id, created_at desc);
create index parent_notifications_unread_idx on public.parent_notifications(parent_id) where read_at is null;
alter table public.parent_notifications enable row level security;
create policy parent_notifications_own_select on public.parent_notifications for select to authenticated using (parent_id = auth.uid());
create policy parent_notifications_own_update on public.parent_notifications for update to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());
