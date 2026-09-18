-- V2 (beta): video presenters. Additive only.
-- Presenter photos are fetched by the video service, so that bucket is public; the rendered clips stay private.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('presenters', 'presenters', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-videos', 'lesson-videos', false, 26214400, array['video/mp4'])
on conflict (id) do nothing;

-- One rendered clip per spoken line, presenter and voice; served through the app.
create table public.lesson_videos (
  id text primary key,                        -- hash of presenter, voice and text
  character_id text not null,
  voice text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  talk_id text,
  path text,
  error text,
  seconds numeric,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index lesson_videos_month_idx on public.lesson_videos(created_at desc);
alter table public.lesson_videos enable row level security;
