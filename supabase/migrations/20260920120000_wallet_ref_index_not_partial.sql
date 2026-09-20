-- The idempotency index was partial (`where ref_id is not null`), and Postgres will not infer an arbiter from a
-- partial index unless the statement carries the same predicate. PostgREST's upsert does not, so every
-- `on conflict (student_id, ref_type, ref_id)` raised 42P10 and no allowance week, cash reward or approved
-- expense claim was ever written to a wallet.
--
-- Dropping the predicate changes nothing about what is unique: `ref_id` is null on every hand-entered line, and
-- nulls are distinct by default, so those rows still never collide with each other. It only makes the index
-- something `on conflict` can name.
drop index if exists public.wallet_entries_ref_idx;
create unique index wallet_entries_ref_idx
  on public.wallet_entries (student_id, ref_type, ref_id);
