-- Prayers logged after the window: on time (at school), late, or missed, said honestly. The parent sees "logged later".
alter type public.prayer_status add value if not exists 'missed';
alter table public.prayer_logs
  add column entered_late boolean not null default false,   -- logged after the window closed
  add column claim text;                                     -- 'school' (window fell in school hours) | 'other'

-- "Straight talk": a weekly honesty check the child knows is shared with the parents (labels only).
alter table public.wellbeing_checks drop constraint if exists wellbeing_checks_instrument_check;
alter table public.wellbeing_checks add constraint wellbeing_checks_instrument_check check (instrument in ('pulse', 'who5', 'mindset', 'habits', 'straight'));
