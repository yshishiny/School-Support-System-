-- V2 (beta): real photographs for lesson scenes, found once per search phrase on Wikimedia Commons. Additive only.
create table public.scene_photos (
  id text primary key,                -- hash of the search phrase
  query text not null,
  url text,                           -- 800 px rendition; null when nothing suitable was found
  page text,
  credit text,
  license text,
  created_at timestamptz not null default now()
);
alter table public.scene_photos enable row level security;
