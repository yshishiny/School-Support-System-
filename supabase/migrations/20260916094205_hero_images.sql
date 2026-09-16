-- Personal "hero" pictures per child (private bucket, signed URLs), chosen as avatar and home banner.
create table public.hero_images (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  path text not null,
  caption text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index hero_images_student_idx on public.hero_images(student_id, created_at desc);
alter table public.hero_images enable row level security;
create policy hero_images_family_select on public.hero_images for select to authenticated using (app_private.student_in_family(student_id));
create policy hero_images_parent_write on public.hero_images for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
create policy hero_images_student_write on public.hero_images for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

alter table public.profiles
  add column avatar_image_id uuid references public.hero_images(id) on delete set null,
  add column banner_image_id uuid references public.hero_images(id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hero-images', 'hero-images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Paths are <family_id>/<student_id>/<file>. Family members read; parents and the child himself write under his folder.
create policy hero_images_read on storage.objects for select to authenticated
  using (bucket_id = 'hero-images' and (storage.foldername(name))[1] = app_private.current_family_id()::text);
create policy hero_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'hero-images' and (storage.foldername(name))[1] = app_private.current_family_id()::text
    and (app_private.current_role_is('parent') or (storage.foldername(name))[2] = auth.uid()::text));
create policy hero_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'hero-images' and (storage.foldername(name))[1] = app_private.current_family_id()::text
    and (app_private.current_role_is('parent') or (storage.foldername(name))[2] = auth.uid()::text));
