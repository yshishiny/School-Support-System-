-- V2 (beta): Arabic lines vowelled once for the voices (tashkeel), keyed by a hash of the text. Additive only.
create table public.spoken_lines (
  id text primary key,
  language text not null,
  text text not null,
  spoken text not null,
  created_at timestamptz not null default now()
);
alter table public.spoken_lines enable row level security;
