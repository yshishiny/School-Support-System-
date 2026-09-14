-- Corrections from the school's own documents (KIS American Division, 2026/2027):
--  * Grade 10 science is Biology + Physics (not Chemistry).
--  * Grade 10 has SAT preparation periods, so add a Digital SAT track next to ACT.
--  * Seed the real weekly timetables so new child accounts start with them.

delete from public.topics where family_id is null and track = 'school' and grade = 10 and unit = 'Chemistry';
delete from public.topics where family_id is null and track = 'school' and grade = 10 and unit = 'Biology';

insert into public.topics (track, grade, subject, unit, name, sort) values
('school', 10, 'Biology', 'Cells', 'Cell structure, membranes, and transport', 1),
('school', 10, 'Biology', 'Cells', 'Photosynthesis and cellular respiration', 2),
('school', 10, 'Biology', 'Cells', 'Cell division: mitosis and meiosis', 3),
('school', 10, 'Biology', 'Genetics', 'DNA structure, replication, and protein synthesis', 4),
('school', 10, 'Biology', 'Genetics', 'Mendelian genetics and Punnett squares', 5),
('school', 10, 'Biology', 'Genetics', 'Mutations and biotechnology', 6),
('school', 10, 'Biology', 'Evolution', 'Natural selection and evidence for evolution', 7),
('school', 10, 'Biology', 'Ecology', 'Ecosystems, energy flow, and cycles', 8),
('school', 10, 'Biology', 'Ecology', 'Populations, communities, and human impact', 9),
('school', 10, 'Biology', 'Human Body', 'Body systems and homeostasis', 10),
('school', 10, 'Physics', 'Mechanics', 'Motion: speed, velocity, acceleration, and graphs', 1),
('school', 10, 'Physics', 'Mechanics', 'Newton''s laws and free-body diagrams', 2),
('school', 10, 'Physics', 'Mechanics', 'Vectors and projectile motion', 3),
('school', 10, 'Physics', 'Energy', 'Work, energy, and power', 4),
('school', 10, 'Physics', 'Energy', 'Momentum and collisions', 5),
('school', 10, 'Physics', 'Waves', 'Waves, sound, and the Doppler effect', 6),
('school', 10, 'Physics', 'Waves', 'Light, reflection, refraction, and lenses', 7),
('school', 10, 'Physics', 'Electricity', 'Electric charge, current, voltage, and Ohm''s law', 8),
('school', 10, 'Physics', 'Electricity', 'Series and parallel circuits', 9),
('school', 10, 'Physics', 'Electricity', 'Magnetism and electromagnetism', 10),
('school', 10, 'Physics', 'Thermal', 'Heat, temperature, and thermal energy transfer', 11);

-- Digital SAT track (Reading & Writing 54 q / 64 min; Math 44 q / 70 min)
insert into public.topics (track, subject, act_section, unit, name, description, sort) values
('sat', 'SAT Reading & Writing', 'sat_rw', 'Information and Ideas', 'Central ideas, details, and inferences', '54 questions, 64 minutes', 1),
('sat', 'SAT Reading & Writing', 'sat_rw', 'Information and Ideas', 'Command of evidence: text and data', null, 2),
('sat', 'SAT Reading & Writing', 'sat_rw', 'Craft and Structure', 'Words in context and text structure', null, 3),
('sat', 'SAT Reading & Writing', 'sat_rw', 'Craft and Structure', 'Cross-text connections', null, 4),
('sat', 'SAT Reading & Writing', 'sat_rw', 'Expression of Ideas', 'Transitions and rhetorical synthesis', null, 5),
('sat', 'SAT Reading & Writing', 'sat_rw', 'Standard English Conventions', 'Boundaries: punctuation and sentence structure', null, 6),
('sat', 'SAT Reading & Writing', 'sat_rw', 'Standard English Conventions', 'Form, structure, and sense: agreement, tense, modifiers', null, 7),
('sat', 'SAT Math', 'sat_math', 'Algebra', 'Linear equations, inequalities, and systems', '44 questions, 70 minutes', 1),
('sat', 'SAT Math', 'sat_math', 'Advanced Math', 'Quadratics, polynomials, and nonlinear functions', null, 2),
('sat', 'SAT Math', 'sat_math', 'Advanced Math', 'Exponential functions and equivalent expressions', null, 3),
('sat', 'SAT Math', 'sat_math', 'Problem Solving and Data Analysis', 'Ratios, rates, percents, and units', null, 4),
('sat', 'SAT Math', 'sat_math', 'Problem Solving and Data Analysis', 'Statistics, probability, and data interpretation', null, 5),
('sat', 'SAT Math', 'sat_math', 'Geometry and Trigonometry', 'Area, volume, triangles, circles, and trigonometry', null, 6);

-- School timetable templates, copied into a child's timetable when the account is created
create table public.timetable_templates (
  id uuid primary key default gen_random_uuid(),
  grade int not null,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  subject_name text not null,
  teacher text,
  sort int not null default 0
);
alter table public.timetable_templates enable row level security;
create policy templates_select on public.timetable_templates for select to authenticated using (true);

-- Periods: 1 07:55-08:40, 2 08:40-09:25, 3 09:25-10:05, 4 10:05-10:55, 5 10:55-11:25, break, 6 12:05-12:45, 7 12:45-13:25, 8 13:25-14:05
-- Grade 8 (American Division 2026/2027). Sunday = 0.
insert into public.timetable_templates (grade, weekday, start_time, end_time, subject_name, teacher, sort) values
(8, 0, '07:55', '08:40', 'Social English', 'Mr. Mai', 1),
(8, 0, '08:40', '10:05', 'P.E.', null, 2),
(8, 0, '10:05', '11:25', 'Social Studies (M.O.E.)', 'Ms. Marwa', 3),
(8, 0, '12:05', '12:45', 'Religion', 'Mr. M. Kamal', 4),
(8, 0, '12:45', '14:05', 'Science', 'Ms. Tasneem', 5),
(8, 1, '07:55', '09:25', 'Arabic', 'Mr. Fahd', 1),
(8, 1, '09:25', '10:55', 'Math', 'Ms. Zainab', 2),
(8, 1, '10:55', '11:25', 'English', 'Ms. Omnia', 3),
(8, 1, '12:05', '12:45', 'English', 'Ms. Omnia', 4),
(8, 1, '12:45', '14:05', 'Social Studies (M.O.E.)', 'Ms. Marwa', 5),
(8, 2, '07:55', '08:40', 'Social English', 'Mr. Mai', 1),
(8, 2, '08:40', '09:25', 'Science', 'Ms. Tasneem', 2),
(8, 2, '09:25', '10:55', 'English', 'Ms. Omnia', 3),
(8, 2, '10:55', '11:25', 'Religion', 'Mr. M. Kamal', 4),
(8, 2, '12:05', '12:45', 'Music', 'Ms. Reham', 5),
(8, 2, '12:45', '14:05', 'Math', 'Ms. Zainab', 6),
(8, 3, '07:55', '09:25', 'Science', 'Ms. Tasneem', 1),
(8, 3, '09:25', '10:55', 'English', 'Ms. Omnia', 2),
(8, 3, '10:55', '11:25', 'Arabic', 'Mr. Fahd', 3),
(8, 3, '12:05', '12:45', 'Arabic', 'Mr. Fahd', 4),
(8, 3, '12:45', '14:05', 'French / German', 'Ms. Aisha / Ms. Soad', 5),
(8, 4, '07:55', '09:25', 'English', 'Ms. Omnia', 1),
(8, 4, '09:25', '10:55', 'Arabic', 'Mr. Fahd', 2),
(8, 4, '10:55', '11:25', 'Art', 'Ms. Radea', 3),
(8, 4, '12:05', '12:45', 'Art', 'Ms. Radea', 4),
(8, 4, '12:45', '14:05', 'Math', 'Ms. Zainab', 5),
-- Grade 10 (American Division 2026/2027). Tuesday has no classes on the published timetable.
(10, 0, '07:55', '09:25', 'English (GPA)', null, 1),
(10, 0, '09:25', '10:55', 'Arabic', null, 2),
(10, 0, '10:55', '11:25', 'Biology', null, 3),
(10, 0, '12:05', '13:25', 'English Pre-SAT', null, 4),
(10, 0, '13:25', '14:05', 'History', null, 5),
(10, 1, '07:55', '09:25', 'French / German', 'Ms. Aisha / Ms. Soad', 1),
(10, 1, '09:25', '10:55', 'Arabic', null, 2),
(10, 1, '10:55', '11:25', 'English SAT', null, 3),
(10, 1, '12:05', '12:45', 'English SAT', null, 4),
(10, 1, '12:45', '14:05', 'Math (GPA)', null, 5),
(10, 3, '07:55', '09:25', 'Physics', null, 1),
(10, 3, '09:25', '10:55', 'Biology', null, 2),
(10, 3, '10:55', '11:25', 'Arabic Social Studies', null, 3),
(10, 3, '12:05', '12:45', 'Arabic Social Studies', null, 4),
(10, 3, '12:45', '14:05', 'English Pre-SAT', null, 5),
(10, 4, '07:55', '09:25', 'Math SAT', null, 1),
(10, 4, '09:25', '10:05', 'History', null, 2),
(10, 4, '10:05', '10:55', 'Math (GPA)', null, 3),
(10, 4, '10:55', '11:25', 'Physics', null, 4),
(10, 4, '12:05', '13:25', 'P.E.', null, 5),
(10, 4, '13:25', '14:05', 'Math (GPA)', null, 6);
