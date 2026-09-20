-- A month that ends without a word is how a paying family becomes a former one. The warning goes out three days
-- before and again on the day it lapses; this records which of those two has been sent, so the reminder never
-- becomes nightly noise that nobody reads.
alter table public.access_grants add column if not exists warned_days_left int;
