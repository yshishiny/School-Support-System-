-- SHA-256 of the file's bytes, computed in the browser before the upload starts.
--
-- Two things need it. A parent who sends the same PDF twice should be told, not charged for a second AI read
-- of a file the app has already understood; and the AI title cannot answer "is this the same file?" because
-- two different worksheets in one batch were both titled "Story Settings Description".
--
-- Not unique: the same worksheet legitimately goes to two children, and a re-upload after a delete is fine.
-- Duplicates are reported, never refused.
alter table materials add column if not exists content_sha256 text;
create index if not exists materials_family_sha_idx on materials (family_id, content_sha256) where content_sha256 is not null;
