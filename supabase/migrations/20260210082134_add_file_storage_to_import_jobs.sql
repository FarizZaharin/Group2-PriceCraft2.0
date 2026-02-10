/*
  # Add File Storage Fields to Import Jobs

  1. Changes
    - Add `file_path` column to `import_jobs` table for storing Supabase Storage path
    - Add `file_type` column to `import_jobs` table to record file format (csv/xlsx)
  
  2. Details
    - Both columns are nullable to support existing import jobs
    - `file_path` stores the full storage path (e.g., 'import-files/{estimate_id}/{import_job_id}/original.xlsx')
    - `file_type` stores the file format ('csv' or 'xlsx')
  
  3. Purpose
    - Provides audit trail by linking import jobs to original uploaded files
    - Enables file retrieval for troubleshooting and verification
*/

-- Add file storage columns to import_jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN file_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN file_type text;
  END IF;
END $$;