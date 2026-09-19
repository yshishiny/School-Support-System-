-- V2 (beta): which visual pass a script has had (illustrator drawings, photographs), separate from the text version,
-- so older lessons can get better pictures without rewriting the words (and without re-rendering their clips).
alter table public.lesson_scripts add column if not exists visuals_version int;
