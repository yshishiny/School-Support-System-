-- Whether a school file actually has anything to answer.
--
-- Transcribing a sheet into questions a child can sit on his phone was gated on the reader's `kind` label, and
-- that label was the wrong signal in both directions: a study guide carrying thirty practice questions was
-- never offered to anybody, and a file labelled "worksheet" that turned out to be a reading passage cost an AI
-- call that came back with nothing. The reader is now asked the question directly, in the same call, and the
-- answer is kept here.
--
-- `worksheet_error` is the other half. Auto-transcription runs without anybody watching, so a failure had
-- nowhere to be recorded and the sheet simply stayed unanswerable with no reason given. It is shown to the
-- parent and is what the nightly sweep uses to decide whether to try again.

alter table public.materials add column if not exists has_questions   boolean;
alter table public.materials add column if not exists question_count  int;
alter table public.materials add column if not exists worksheet_error text;

-- The sweep asks one question: which ready files have questions and no transcription yet? Answered from the
-- index rather than by reading every file the family has ever uploaded.
create index if not exists materials_awaiting_worksheet_idx
  on public.materials (family_id, created_at desc)
  where status = 'ready' and has_questions and worksheet is null;
