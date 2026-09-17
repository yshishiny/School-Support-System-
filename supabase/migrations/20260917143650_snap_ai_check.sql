-- Families can switch the AI first look on snaps off; then every snap goes straight to a parent or rater sibling.
alter table public.families add column snap_ai_check boolean not null default true;
