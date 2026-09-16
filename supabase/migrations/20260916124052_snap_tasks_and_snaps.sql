-- "Show your win": photo tasks a child completes when no adult is around (bed, desk, dish, homework page)
-- and weekly handwriting samples. The AI screens each picture; a parent approves; approval feeds the allowance.
create table public.snap_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,   -- null = every child in the family
  code text not null,                                                   -- bed | desk | dish | homework | handwriting | custom
  kind text not null check (kind in ('photo', 'homework', 'handwriting')),
  label text not null,
  emoji text not null default '📷',
  prompt text,                                                          -- what "good" looks like, for the AI check
  days int[] not null default '{0,1,2,3,4,5,6}',                        -- weekdays the task is due (0 = Sunday)
  window_start time,                                                    -- optional time window (family timezone)
  window_end time,
  weight int not null default 10,                                       -- share in the allowance score
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index snap_tasks_family_idx on public.snap_tasks(family_id);
alter table public.snap_tasks enable row level security;
create policy snap_tasks_select on public.snap_tasks for select to authenticated using (family_id = app_private.current_family_id());
create policy snap_tasks_parent_write on public.snap_tasks for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

create table public.snaps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  task_id uuid references public.snap_tasks(id) on delete set null,
  task_code text not null,
  kind text not null check (kind in ('photo', 'homework', 'handwriting')),
  path text not null,
  sha256 text,
  taken_on date not null,
  ai_verdict text check (ai_verdict in ('looks_good', 'unclear', 'not_it', 'people', 'error')),
  ai_score numeric(3,2),                                                -- 0..1 plausibility
  ai_note text,
  ai_detail jsonb,                                                      -- handwriting analysis, homework reading
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index snaps_student_day_idx on public.snaps(student_id, taken_on desc);
create index snaps_family_status_idx on public.snaps(family_id, status, created_at desc);
create unique index snaps_student_sha_idx on public.snaps(student_id, sha256) where sha256 is not null;
alter table public.snaps enable row level security;
create policy snaps_family_select on public.snaps for select to authenticated using (app_private.student_in_family(student_id));
create policy snaps_student_insert on public.snaps for insert to authenticated with check (student_id = auth.uid());
create policy snaps_parent_update on public.snaps for update to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('snaps', 'snaps', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Paths are <family_id>/<student_id>/<file>. The child uploads under his own folder; the family reads.
create policy snaps_read on storage.objects for select to authenticated
  using (bucket_id = 'snaps' and (storage.foldername(name))[1] = app_private.current_family_id()::text);
create policy snaps_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'snaps' and (storage.foldername(name))[1] = app_private.current_family_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text);
