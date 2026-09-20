-- Money a child spent on the family or on school can be claimed back. He must say what it was for, why he spent
-- it and whether he asked first; a parent decides, and an approved claim pays the amount back into his wallet.
alter table public.wallet_entries add column if not exists claim_status text not null default 'none';
alter table public.wallet_entries add column if not exists claim_purpose text;
alter table public.wallet_entries add column if not exists claim_reason text;
alter table public.wallet_entries add column if not exists asked_permission boolean;
alter table public.wallet_entries add column if not exists claim_note text;
alter table public.wallet_entries add column if not exists claim_decided_by uuid references public.profiles(id) on delete set null;
alter table public.wallet_entries add column if not exists claim_decided_at timestamptz;

alter table public.wallet_entries drop constraint if exists wallet_entries_claim_status_check;
alter table public.wallet_entries add constraint wallet_entries_claim_status_check
  check (claim_status in ('none', 'requested', 'approved', 'rejected'));
alter table public.wallet_entries drop constraint if exists wallet_entries_claim_purpose_check;
alter table public.wallet_entries add constraint wallet_entries_claim_purpose_check
  check (claim_purpose is null or claim_purpose in ('family', 'school'));

create index if not exists wallet_entries_claim_idx on public.wallet_entries(family_id, claim_status) where claim_status = 'requested';

comment on column public.wallet_entries.claim_purpose is 'Only family or school spending may be claimed back; personal spending may not.';
