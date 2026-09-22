-- Papers a parent has to sign.
--
-- Schools send consent slips, test papers to be signed and returned, and trip forms. None of these were
-- modelled: the file reader could only file them as "note", where they sat among reminders a child reads and
-- nobody was ever told a signature was owed. A child cannot clear one of these by doing it, so signing is kept
-- apart from completing — a paper is done when the parent has signed it, and by whom is worth knowing in a
-- house with two parents.
alter type assignment_kind add value if not exists 'sign';

alter table assignments add column if not exists signed_at timestamptz;
alter table assignments add column if not exists signed_by uuid references profiles(id) on delete set null;

create index if not exists assignments_to_sign_idx
  on assignments (student_id, due_date)
  where signed_at is null;
