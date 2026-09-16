-- Banner mode: 'cover' crops to the banner shape (zoom/pan apply); 'full' shows the whole picture over a blurred backdrop.
alter table public.profiles add column banner_fit text not null default 'full' check (banner_fit in ('cover', 'full'));
