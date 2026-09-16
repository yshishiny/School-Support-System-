-- Allow zooming out (picture smaller than the banner, shown over the blurred backdrop).
alter table public.profiles drop constraint if exists profiles_banner_zoom_check;
alter table public.profiles add constraint profiles_banner_zoom_check check (banner_zoom between 0.5 and 3);
