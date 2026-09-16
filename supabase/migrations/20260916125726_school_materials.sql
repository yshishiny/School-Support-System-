-- School files (PDFs, photos) shared in the class groups: uploaded by a parent or the child with a subject
-- and instructions. The AI reads them once (summary, topics, suggested tasks, study digest for quizzes).
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  subject text,
  title text not null,
  instructions text,                                   -- what the teacher asked: "solve p.3-5 by Thursday"
  path text not null,
  mime text not null,
  size_bytes int not null default 0,
  status text not null default 'new' check (status in ('new', 'ready', 'failed')),
  kind text,                                           -- worksheet | notes | study_guide | announcement | other
  summary text,
  language text,
  topics jsonb,                                        -- ["Linear equations", ...]
  digest text,                                         -- compact study version used to write quizzes
  items jsonb,                                         -- suggested tasks (ExtractedItem[])
  items_reviewed_at timestamptz,
  error text,
  pages int,
  created_at timestamptz not null default now()
);
create index materials_student_idx on public.materials(student_id, created_at desc);
create index materials_family_idx on public.materials(family_id, created_at desc);
alter table public.materials enable row level security;
create policy materials_family_select on public.materials for select to authenticated using (app_private.student_in_family(student_id));
create policy materials_parent_write on public.materials for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
create policy materials_student_insert on public.materials for insert to authenticated with check (student_id = auth.uid());
create policy materials_student_update on public.materials for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

alter table public.quizzes add column material_id uuid references public.materials(id) on delete set null;
create index quizzes_material_idx on public.quizzes(material_id) where material_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 26214400, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Paths are <family_id>/<student_id>/<file>. Family reads; parents upload anywhere in the family, the child under his folder.
create policy materials_read on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = app_private.current_family_id()::text);
create policy materials_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = app_private.current_family_id()::text
    and (app_private.current_role_is('parent') or (storage.foldername(name))[2] = auth.uid()::text));
create policy materials_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = app_private.current_family_id()::text and app_private.current_role_is('parent'));
