/*
  # Create Import Files Storage Bucket

  1. New Storage Bucket
    - `import-files` - Stores uploaded CSV and Excel files for import audit trail
  
  2. Security
    - Enable RLS on storage.objects
    - Authenticated users can upload files to their own estimates
    - Authenticated users can read files from estimates they have access to
  
  3. Bucket Configuration
    - Public: false (requires authentication)
    - File size limit: 5MB (matches upload validation)
    - Allowed MIME types: text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel
*/

-- Create the import-files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'import-files',
  'import-files',
  false,
  5242880, -- 5MB in bytes
  ARRAY['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload files to their own estimates
CREATE POLICY "Users can upload import files for accessible estimates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'import-files' AND
  auth.uid() IN (
    SELECT owner_user_id FROM estimates
    WHERE id::text = (string_to_array(name, '/'))[1]
  )
);

-- Policy: Authenticated users can read files from estimates they have access to
CREATE POLICY "Users can read import files from accessible estimates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'import-files' AND
  auth.uid() IN (
    SELECT owner_user_id FROM estimates
    WHERE id::text = (string_to_array(name, '/'))[1]
  )
);

-- Policy: Authenticated users can delete files from their own estimates
CREATE POLICY "Users can delete import files from accessible estimates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'import-files' AND
  auth.uid() IN (
    SELECT owner_user_id FROM estimates
    WHERE id::text = (string_to_array(name, '/'))[1]
  )
);