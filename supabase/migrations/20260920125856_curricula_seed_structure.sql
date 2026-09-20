insert into public.curricula (id, name, name_ar, language, note, sort) values
  ('american', 'American (Common Core / NGSS)', 'المنهج الأمريكي', 'en',
   'Grades 6-12. Middle school 6-8, high school 9-12, where subjects are courses rather than a fixed year list.', 1),
  ('egyptian_national', 'Egyptian National', 'المنهج المصري', 'ar',
   'Prep 7-9 and secondary 10-12. The first secondary year is common; from the second the child follows a stream.', 2)
on conflict (id) do update set name = excluded.name, name_ar = excluded.name_ar, language = excluded.language, note = excluded.note, sort = excluded.sort;

-- ── American: a grade is a grade, and nothing is streamed ────────────────────
insert into public.curriculum_levels (curriculum_id, grade, stage, stream, label, sort) values
  ('american',  6, 'middle', null, 'Grade 6',  6),
  ('american',  7, 'middle', null, 'Grade 7',  7),
  ('american',  8, 'middle', null, 'Grade 8',  8),
  ('american',  9, 'high',   null, 'Grade 9 (Freshman)',   9),
  ('american', 10, 'high',   null, 'Grade 10 (Sophomore)', 10),
  ('american', 11, 'high',   null, 'Grade 11 (Junior)',    11),
  ('american', 12, 'high',   null, 'Grade 12 (Senior)',    12)
on conflict (curriculum_id, grade, stream) do update set label = excluded.label, stage = excluded.stage, sort = excluded.sort;

-- ── Egyptian: prep is common, secondary streams from the second year ─────────
insert into public.curriculum_levels (curriculum_id, grade, stage, stream, label, label_ar, sort) values
  ('egyptian_national',  7, 'prep',      null,           'Prep 1',                  'الصف الأول الإعدادي',            7),
  ('egyptian_national',  8, 'prep',      null,           'Prep 2',                  'الصف الثاني الإعدادي',           8),
  ('egyptian_national',  9, 'prep',      null,           'Prep 3',                  'الصف الثالث الإعدادي',           9),
  ('egyptian_national', 10, 'secondary', null,           'Secondary 1',             'الصف الأول الثانوي',            10),
  ('egyptian_national', 11, 'secondary', 'science',      'Secondary 2 — Science',   'الصف الثاني الثانوي — علمي',    11),
  ('egyptian_national', 11, 'secondary', 'literary',     'Secondary 2 — Literary',  'الصف الثاني الثانوي — أدبي',    12),
  ('egyptian_national', 12, 'secondary', 'science_bio',  'Secondary 3 — Science',   'الصف الثالث الثانوي — علمي علوم', 13),
  ('egyptian_national', 12, 'secondary', 'science_math', 'Secondary 3 — Mathematics','الصف الثالث الثانوي — علمي رياضة', 14),
  ('egyptian_national', 12, 'secondary', 'literary',     'Secondary 3 — Literary',  'الصف الثالث الثانوي — أدبي',    15)
on conflict (curriculum_id, grade, stream) do update set label = excluded.label, label_ar = excluded.label_ar, stage = excluded.stage, sort = excluded.sort;

-- ── American subjects ───────────────────────────────────────────────────────
insert into public.curriculum_subjects (curriculum_id, grade, stream, subject, language, core, sort)
select 'american', g, null, s.subject, 'en', s.core, s.sort
from generate_series(6, 8) g
cross join (values
  ('Mathematics', true, 1), ('Science', true, 2), ('English Language Arts', true, 3),
  ('Social Studies', true, 4), ('Computer Science', false, 5), ('Art', false, 6), ('Physical Education', false, 7)
) as s(subject, core, sort)
on conflict (curriculum_id, grade, stream, subject) do nothing;

insert into public.curriculum_subjects (curriculum_id, grade, stream, subject, language, core, sort) values
  ('american',  9, null, 'Algebra I','en', true, 1), ('american',  9, null, 'Biology','en', true, 2),
  ('american',  9, null, 'English 9','en', true, 3), ('american',  9, null, 'World History','en', true, 4),
  ('american',  9, null, 'Computer Science','en', false, 5),
  ('american', 10, null, 'Geometry','en', true, 1), ('american', 10, null, 'Chemistry','en', true, 2),
  ('american', 10, null, 'English 10','en', true, 3), ('american', 10, null, 'World History II','en', true, 4),
  ('american', 10, null, 'Computer Science','en', false, 5),
  ('american', 11, null, 'Algebra II','en', true, 1), ('american', 11, null, 'Physics','en', true, 2),
  ('american', 11, null, 'English 11','en', true, 3), ('american', 11, null, 'US History','en', true, 4),
  ('american', 11, null, 'Statistics','en', false, 5),
  ('american', 12, null, 'Pre-Calculus','en', true, 1), ('american', 12, null, 'Calculus','en', false, 2),
  ('american', 12, null, 'English 12','en', true, 3), ('american', 12, null, 'Government and Economics','en', true, 4),
  ('american', 12, null, 'Environmental Science','en', false, 5)
on conflict (curriculum_id, grade, stream, subject) do nothing;

-- ── Egyptian prep: one list for all three years, Arabic-medium but for English ──
insert into public.curriculum_subjects (curriculum_id, grade, stream, subject, subject_ar, language, core, sort)
select 'egyptian_national', g, null, s.subject, s.subject_ar, s.language, true, s.sort
from generate_series(7, 9) g
cross join (values
  ('Mathematics','الرياضيات','ar',1), ('Science','العلوم','ar',2), ('Arabic','اللغة العربية','ar',3),
  ('English','اللغة الإنجليزية','en',4), ('Social Studies','الدراسات الاجتماعية','ar',5), ('Religion','التربية الدينية','ar',6)
) as s(subject, subject_ar, language, sort)
on conflict (curriculum_id, grade, stream, subject) do nothing;

insert into public.curriculum_subjects (curriculum_id, grade, stream, subject, subject_ar, language, core, sort) values
  ('egyptian_national', 10, null, 'Mathematics','الرياضيات','ar', true, 1),
  ('egyptian_national', 10, null, 'Physics','الفيزياء','ar', true, 2),
  ('egyptian_national', 10, null, 'Chemistry','الكيمياء','ar', true, 3),
  ('egyptian_national', 10, null, 'Biology','الأحياء','ar', true, 4),
  ('egyptian_national', 10, null, 'Arabic','اللغة العربية','ar', true, 5),
  ('egyptian_national', 10, null, 'English','اللغة الإنجليزية','en', true, 6),
  ('egyptian_national', 10, null, 'History','التاريخ','ar', true, 7),
  ('egyptian_national', 10, null, 'Geography','الجغرافيا','ar', true, 8),
  ('egyptian_national', 10, null, 'Philosophy and Logic','الفلسفة والمنطق','ar', false, 9),
  ('egyptian_national', 11, 'science','Pure Mathematics','الرياضيات البحتة','ar', true, 1),
  ('egyptian_national', 11, 'science','Physics','الفيزياء','ar', true, 2),
  ('egyptian_national', 11, 'science','Chemistry','الكيمياء','ar', true, 3),
  ('egyptian_national', 11, 'science','Biology','الأحياء','ar', true, 4),
  ('egyptian_national', 11, 'science','Arabic','اللغة العربية','ar', true, 5),
  ('egyptian_national', 11, 'science','English','اللغة الإنجليزية','en', true, 6),
  ('egyptian_national', 11, 'literary','History','التاريخ','ar', true, 1),
  ('egyptian_national', 11, 'literary','Geography','الجغرافيا','ar', true, 2),
  ('egyptian_national', 11, 'literary','Philosophy and Logic','الفلسفة والمنطق','ar', true, 3),
  ('egyptian_national', 11, 'literary','Psychology and Sociology','علم النفس والاجتماع','ar', true, 4),
  ('egyptian_national', 11, 'literary','Arabic','اللغة العربية','ar', true, 5),
  ('egyptian_national', 11, 'literary','English','اللغة الإنجليزية','en', true, 6),
  ('egyptian_national', 11, 'literary','Applied Mathematics','الرياضيات التطبيقية','ar', false, 7),
  ('egyptian_national', 12, 'science_bio','Biology','الأحياء','ar', true, 1),
  ('egyptian_national', 12, 'science_bio','Chemistry','الكيمياء','ar', true, 2),
  ('egyptian_national', 12, 'science_bio','Physics','الفيزياء','ar', true, 3),
  ('egyptian_national', 12, 'science_bio','Geology','الجيولوجيا','ar', true, 4),
  ('egyptian_national', 12, 'science_bio','Arabic','اللغة العربية','ar', true, 5),
  ('egyptian_national', 12, 'science_bio','English','اللغة الإنجليزية','en', true, 6),
  ('egyptian_national', 12, 'science_math','Pure Mathematics','الرياضيات البحتة','ar', true, 1),
  ('egyptian_national', 12, 'science_math','Applied Mathematics','الرياضيات التطبيقية','ar', true, 2),
  ('egyptian_national', 12, 'science_math','Physics','الفيزياء','ar', true, 3),
  ('egyptian_national', 12, 'science_math','Chemistry','الكيمياء','ar', true, 4),
  ('egyptian_national', 12, 'science_math','Arabic','اللغة العربية','ar', true, 5),
  ('egyptian_national', 12, 'science_math','English','اللغة الإنجليزية','en', true, 6),
  ('egyptian_national', 12, 'literary','History','التاريخ','ar', true, 1),
  ('egyptian_national', 12, 'literary','Geography','الجغرافيا','ar', true, 2),
  ('egyptian_national', 12, 'literary','Philosophy and Logic','الفلسفة والمنطق','ar', true, 3),
  ('egyptian_national', 12, 'literary','Psychology and Sociology','علم النفس والاجتماع','ar', true, 4),
  ('egyptian_national', 12, 'literary','Arabic','اللغة العربية','ar', true, 5),
  ('egyptian_national', 12, 'literary','English','اللغة الإنجليزية','en', true, 6)
on conflict (curriculum_id, grade, stream, subject) do nothing;
