-- Also set the project-wide Storage file size limit to at least 150 MB.
update storage.buckets
set file_size_limit = 157286400
where id = 'portfolio-media'
returning id, file_size_limit;
