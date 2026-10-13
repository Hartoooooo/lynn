-- Excel- und CSV-Anhänge erlauben, Limit auf 25 MB.
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel',
      'text/csv'
    ]
where id = 'media';
