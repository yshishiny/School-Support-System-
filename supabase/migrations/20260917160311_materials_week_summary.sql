-- Weekly syllabus / summary files: which week they cover (Sunday), the per-subject breakdown, and a note when the file's own dates look wrong.
alter table public.materials add column is_week_summary boolean not null default false;
alter table public.materials add column covers_week_start date;
alter table public.materials add column covers_from date;
alter table public.materials add column covers_to date;
alter table public.materials add column date_note text;
alter table public.materials add column subjects jsonb not null default '[]'::jsonb;   -- [{subject, topics[]}]
create index materials_week_idx on public.materials(student_id, covers_week_start) where covers_week_start is not null;

-- The syllabus photo uploaded on 17 Sep 2026 with a typo in its dates covers this week.
update public.materials set is_week_summary = true, covers_week_start = '2026-09-13', covers_from = '2026-03-01', covers_to = '2026-03-05',
  date_note = 'The file says 1/3/2026–5/3/2026 (a typo at school); set to this week by the parent.'
where title like 'Grade 10 Weekly Syllabus%';
