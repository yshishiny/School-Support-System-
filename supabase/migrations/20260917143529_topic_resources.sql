-- Visuals (SVG diagrams) and video lessons per topic, cached like lessons.
create table public.topic_resources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  grade int,
  visuals jsonb not null default '[]'::jsonb,   -- [{title, caption, svg}]
  videos jsonb not null default '[]'::jsonb,    -- [{title, channel, query, url, video_id, source}]
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, grade)
);
alter table public.topic_resources enable row level security;
create policy topic_resources_select on public.topic_resources for select to authenticated using (true);
