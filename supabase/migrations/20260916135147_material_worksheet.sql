-- A worksheet transcribed into on-system practice: the sheet's own questions with an answer key, done once per file.
alter table public.materials add column worksheet jsonb;   -- {questions: [...], skipped: n, note: text, model: text, prepared_at: iso}
