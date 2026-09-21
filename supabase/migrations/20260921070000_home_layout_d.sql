-- A fourth parent home arrangement: "what happened", which carries the events and the children as faces and
-- keeps every fact about a child on his own page. The constraint listed three letters, so the new one could not
-- be saved at all.
alter table public.profiles drop constraint if exists profiles_home_layout_check;
alter table public.profiles
  add constraint profiles_home_layout_check
  check (home_layout = any (array['a'::text, 'b'::text, 'c'::text, 'd'::text]));
