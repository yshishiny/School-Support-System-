-- How the banner picture is framed: zoom (1-3) and the focal point in percent.
alter table public.profiles
  add column banner_zoom numeric(4,2) not null default 1 check (banner_zoom between 1 and 3),
  add column banner_x int not null default 50 check (banner_x between 0 and 100),
  add column banner_y int not null default 30 check (banner_y between 0 and 100);
