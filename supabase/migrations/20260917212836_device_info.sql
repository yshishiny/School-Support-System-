-- Device dimension: what each person uses the app on (platform, installed app or browser, screen, battery, network), refreshed each session.
alter table public.profiles add column device jsonb;
alter table public.profiles add column app_installed_at timestamptz;
