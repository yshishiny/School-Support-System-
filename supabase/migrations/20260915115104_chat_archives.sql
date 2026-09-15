-- WhatsApp chat archives: a parent uploads an exported chat (zip with media, or .txt) so the app can learn
-- how the school groups communicate and mine them later.
create table public.chat_archives (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete set null,
  label text not null,
  storage_path text not null,               -- original upload in the chat-archives bucket
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error text,
  message_count int not null default 0,
  attachment_count int not null default 0,
  first_date date,
  last_date date,
  stats jsonb,                              -- senders, attachment kinds, busiest weekdays
  insights_md text,                         -- what the AI learned about this group's conventions
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz
);
create index chat_archives_family_idx on public.chat_archives(family_id, uploaded_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  archive_id uuid not null references public.chat_archives(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  sent_date date not null,
  sent_time text not null,
  sender text not null,
  text text not null,
  attachment_name text,
  attachment_kind text,                     -- image | video | audio | pdf | doc | sheet | other
  attachment_path text                      -- storage path of the extracted media file, when present
);
create index chat_messages_archive_idx on public.chat_messages(archive_id, sent_date);
create index chat_messages_family_date_idx on public.chat_messages(family_id, sent_date desc);

alter table public.chat_archives enable row level security;
alter table public.chat_messages enable row level security;
create policy chat_archives_family on public.chat_archives for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
create policy chat_messages_family on public.chat_messages for select to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));

-- Private bucket; parents upload under <family_id>/... and the server processes with the service role.
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-archives', 'chat-archives', false, 104857600)
on conflict (id) do nothing;

create policy chat_archives_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-archives' and (storage.foldername(name))[1] = app_private.current_family_id()::text and app_private.current_role_is('parent'));
create policy chat_archives_read on storage.objects for select to authenticated
  using (bucket_id = 'chat-archives' and (storage.foldername(name))[1] = app_private.current_family_id()::text);
