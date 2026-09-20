-- Praying in congregation at the mosque is worth more than praying alone at home, so the log records where it was.
alter table public.prayer_logs add column if not exists at_mosque boolean not null default false;
create index if not exists prayer_logs_mosque_idx on public.prayer_logs(student_id, log_date) where at_mosque;
comment on column public.prayer_logs.at_mosque is 'Prayed in congregation at the mosque (jama''a), not alone at home.';
