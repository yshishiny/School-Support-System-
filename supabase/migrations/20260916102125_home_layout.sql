-- Which Today layout the child (or parent) picked: a = three things, b = one thing now, c = bento with banner.
alter table public.profiles add column home_layout text not null default 'b' check (home_layout in ('a', 'b', 'c'));
