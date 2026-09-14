-- Must run in its own migration: a new enum value cannot be used in the transaction that adds it.
alter type public.learning_track add value if not exists 'sat';
