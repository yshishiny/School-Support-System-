-- Allowance eligibility loop: claims, a target reward, rewards that need extra effort, sibling raters, monthly grade sheets.
alter table public.profiles
  add column rater boolean not null default false,                 -- an older sibling who may rate manners / dish for the younger ones
  add column target_reward_id uuid references public.rewards(id) on delete set null;
alter table public.allowance_weeks add column claimed_at timestamptz;
alter table public.rewards
  add column requires_full_weeks int not null default 0,           -- e.g. 3 full-allowance weeks in a row before it can be redeemed
  add column effort_note text;                                     -- what "extra effort" means for this reward

create table public.grade_sheets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  month date not null,                                             -- first day of the month the sheet covers
  path text not null,                                              -- in the 'materials' bucket
  mime text not null,
  status text not null default 'new' check (status in ('new', 'ready', 'failed')),
  items jsonb,                                                     -- [{subject, grade, max, percent, comment}]
  average numeric(5,2),
  previous_average numeric(5,2),
  appraisal text,                                                  -- the AI's appraisal for the parent and the child
  error text,
  created_at timestamptz not null default now(),
  unique (student_id, month)
);
alter table public.grade_sheets enable row level security;
create policy grade_sheets_family_select on public.grade_sheets for select to authenticated using (app_private.student_in_family(student_id));
create policy grade_sheets_student_insert on public.grade_sheets for insert to authenticated with check (student_id = auth.uid());
create policy grade_sheets_parent_all on public.grade_sheets for all to authenticated
  using (family_id = app_private.current_family_id() and app_private.current_role_is('parent'))
  with check (family_id = app_private.current_family_id() and app_private.current_role_is('parent'));
