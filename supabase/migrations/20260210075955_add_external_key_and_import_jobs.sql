/*
  # Add external_key to boq_rows and create import_jobs table

  1. Modified Tables
    - `boq_rows`
      - Added `external_key` (text, nullable) for stable CSV upsert matching
      - Added composite index on (boq_version_id, external_key) for efficient lookups

  2. New Tables
    - `import_jobs`
      - `id` (uuid, primary key)
      - `estimate_id` (uuid, FK to estimates)
      - `boq_version_id` (uuid, FK to boq_versions)
      - `actor_user_id` (uuid, FK to users)
      - `file_name` (text) - original uploaded file name
      - `status` (text) - pending, committed, or failed
      - `report_json` (jsonb) - import outcome report
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on `import_jobs`
    - SELECT policy for authenticated users who can access the parent estimate
    - INSERT policy for authenticated users who own the parent estimate
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boq_rows' AND column_name = 'external_key'
  ) THEN
    ALTER TABLE boq_rows ADD COLUMN external_key text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_boq_rows_external_key
  ON boq_rows(boq_version_id, external_key)
  WHERE external_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  boq_version_id uuid NOT NULL REFERENCES boq_versions(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id),
  file_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  report_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_estimate ON import_jobs(estimate_id, created_at DESC);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view import jobs for accessible estimates"
  ON import_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = import_jobs.estimate_id
    )
  );

CREATE POLICY "Estimate owners can create import jobs"
  ON import_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = import_jobs.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );
