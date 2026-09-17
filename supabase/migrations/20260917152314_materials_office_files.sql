-- School files: also Word, PowerPoint, Excel, CSV and plain text.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf','image/jpeg','image/png','image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv','text/plain'
]
where id = 'materials';
