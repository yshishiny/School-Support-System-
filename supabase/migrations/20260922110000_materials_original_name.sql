-- The name the file had on the parent's phone. Stored because the AI title is not an identifier: two different
-- worksheets uploaded together were both called "Story Settings Description", and with the file itself kept
-- under a random UUID there was nothing left that told them apart.
alter table materials add column if not exists original_name text;
