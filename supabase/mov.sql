-- Add MOV without removing other allowed formats or restricting an unrestricted bucket.
update storage.buckets
set allowed_mime_types = case
  when allowed_mime_types is null or 'video/quicktime' = any(allowed_mime_types)
    then allowed_mime_types
  else array_append(allowed_mime_types, 'video/quicktime')
end
where id = 'portfolio-media'
returning id, allowed_mime_types;
