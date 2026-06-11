-- supabase/migrations/20260611090405_create_pilates_class_images_bucket.sql
-- LAFAM Pilates Class Images Storage Bucket
--
-- Purpose:
-- - Creates the Supabase Storage bucket used for Pilates class cover images.
-- - Keeps class image uploads backend-controlled through the NestJS API.
-- - Allows public read access for class image URLs returned by public/admin APIs.
--
-- Important:
-- - Frontend must not write directly to this bucket.
-- - Backend uploads use the Supabase service-role/admin client.
-- - pilates_classes.image_path stores only the internal storage object path.
-- - API responses derive image_url from the bucket + image_path.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'pilates-class-images',
  'pilates-class-images',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'pilates_class_images_public_read'
  ) then
    create policy pilates_class_images_public_read
      on storage.objects
      for select
      to anon, authenticated
      using (
        bucket_id = 'pilates-class-images'
      );
  end if;
end
$$;