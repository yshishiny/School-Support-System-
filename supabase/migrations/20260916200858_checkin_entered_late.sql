-- A missed evening check-in can be filled in later in the week (fewer points, marked for the parent).
alter table public.checkins add column entered_late boolean not null default false;
