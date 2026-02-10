/*
  # PriceCraft Core Schema - Phase 1

  ## Overview
  Creates the complete data structure for tender cost estimation with governance,
  versioning, audit trail, and AI-readiness.

  ## Tables Created

  ### 1. users
  Stores user identity and role for RBAC
  - `id` (uuid, primary key)
  - `name` (text)
  - `email` (text, unique)
  - `role` (enum: admin, procurement_officer, estimator, viewer)
  - `created_at` (timestamptz)

  ### 2. estimates
  Top-level workspace for each tender/project estimate
  - `id` (uuid, primary key)
  - `title` (text) - estimate name
  - `category` (text) - tender type (services, IT, construction, etc.)
  - `location` (text) - project location
  - `currency` (text) - currency code (MYR, USD, etc.)
  - `estimate_class` (text) - AACE classification
  - `timeline_start` (date) - project start date
  - `timeline_end` (date) - project end date
  - `owner_user_id` (uuid, FK to users)
  - `status` (enum: Draft, InReview, Final, Archived)
  - `created_at`, `updated_at` (timestamptz)

  ### 3. sow_versions
  Version history for Scope of Work text per estimate
  - `id` (uuid, primary key)
  - `estimate_id` (uuid, FK to estimates)
  - `version_label` (text) - e.g., "v0.1", "v1.0"
  - `sow_text` (text) - the actual SOW content
  - `created_by_user_id` (uuid, FK to users)
  - `is_current` (boolean) - marks the active version
  - `created_at` (timestamptz)

  ### 4. boq_versions
  Version history for Bill of Quantities per estimate
  - `id` (uuid, primary key)
  - `estimate_id` (uuid, FK to estimates)
  - `version_label` (text) - e.g., "v0.1", "v1.0"
  - `created_by_user_id` (uuid, FK to users)
  - `is_frozen` (boolean) - frozen versions are read-only and used for export
  - `based_on_boq_version_id` (uuid, nullable FK to boq_versions) - supports branching
  - `created_at` (timestamptz)

  ### 5. boq_rows
  Individual line items and section headers in a BoQ version
  - `id` (uuid, primary key)
  - `boq_version_id` (uuid, FK to boq_versions)
  - `row_type` (enum: LineItem, SectionHeader)
  - `item_no` (text) - item number/reference
  - `section` (text) - section grouping
  - `description` (text) - line item description
  - `uom` (text) - unit of measure (LS, m, m2, etc.)
  - `qty` (numeric, nullable) - quantity
  - `rate` (numeric, nullable) - unit rate
  - `amount` (numeric, nullable) - computed: qty × rate
  - `measurement` (text) - measurement notes
  - `assumptions` (text) - assumptions and clarifications
  - `category` (text) - cost category (Prelims, Labour, Material, etc.)
  - `row_status` (enum: AIDraft, Final) - governance state
  - `sort_order` (integer) - display order
  - `created_at`, `updated_at` (timestamptz)

  ### 6. addon_configs
  Add-on percentages and calculation controls per estimate
  - `id` (uuid, primary key)
  - `estimate_id` (uuid, FK to estimates, unique)
  - `prelims_pct` (numeric) - preliminaries/overheads percentage
  - `contingency_pct` (numeric) - contingency percentage
  - `profit_pct` (numeric) - profit margin percentage
  - `tax_pct` (numeric) - tax/SST percentage
  - `rounding_rule` (integer) - decimal places for rounding
  - `created_at`, `updated_at` (timestamptz)

  ### 7. row_comments
  Line-item comments for review workflow
  - `id` (uuid, primary key)
  - `boq_row_id` (uuid, FK to boq_rows)
  - `comment_text` (text)
  - `created_by_user_id` (uuid, FK to users)
  - `created_at` (timestamptz)

  ### 8. audit_logs
  Immutable log of all key actions for governance
  - `id` (uuid, primary key)
  - `estimate_id` (uuid, FK to estimates)
  - `actor_user_id` (uuid, FK to users)
  - `action_type` (text) - action performed (create, edit, freeze, export, accept_ai)
  - `entity_type` (text) - affected entity (estimate, boq_version, boq_row, etc.)
  - `entity_id` (text) - ID of affected entity
  - `before_snapshot` (jsonb, nullable) - state before action
  - `after_snapshot` (jsonb, nullable) - state after action
  - `created_at` (timestamptz)

  ### 9. ai_runs
  Metadata about AI actions (Phase 2 ready)
  - `id` (uuid, primary key)
  - `estimate_id` (uuid, FK to estimates)
  - `sow_version_id` (uuid, FK to sow_versions)
  - `output_boq_version_id` (uuid, nullable FK to boq_versions)
  - `model_name` (text) - AI model used
  - `prompt_context` (jsonb) - input parameters
  - `output_json` (jsonb) - AI output
  - `status` (enum: Draft, Accepted, Rejected)
  - `created_at` (timestamptz)
  - `accepted_by_user_id` (uuid, nullable FK to users)
  - `accepted_at` (timestamptz, nullable)

  ## Security
  - RLS enabled on all tables
  - Basic authenticated user policies for read access
  - Role-based write policies (to be expanded in Phase 2)
  - Audit logs are append-only (read after creation)

  ## Reference Data
  - Default add-on percentages
  - Standard categories: Prelims, Labour, Material, Equipment, Subcon, Other
  - Standard UOMs: LS, m, m2, m3, unit, lot, day, hour, kg, tonne

*/

-- Create enums for type safety
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'procurement_officer', 'estimator', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE estimate_status AS ENUM ('Draft', 'InReview', 'Final', 'Archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE row_type AS ENUM ('LineItem', 'SectionHeader');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE row_status AS ENUM ('AIDraft', 'Final');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_run_status AS ENUM ('Draft', 'Accepted', 'Rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'MYR',
  estimate_class text NOT NULL DEFAULT '',
  timeline_start date,
  timeline_end date,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status estimate_status NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. SOW Versions table
CREATE TABLE IF NOT EXISTS sow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  version_label text NOT NULL DEFAULT 'v0.1',
  sow_text text NOT NULL DEFAULT '',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. BoQ Versions table
CREATE TABLE IF NOT EXISTS boq_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  version_label text NOT NULL DEFAULT 'v0.1',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  is_frozen boolean NOT NULL DEFAULT false,
  based_on_boq_version_id uuid REFERENCES boq_versions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. BoQ Rows table
CREATE TABLE IF NOT EXISTS boq_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_version_id uuid NOT NULL REFERENCES boq_versions(id) ON DELETE CASCADE,
  row_type row_type NOT NULL DEFAULT 'LineItem',
  item_no text NOT NULL DEFAULT '',
  section text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  uom text NOT NULL DEFAULT '',
  qty numeric(15, 3),
  rate numeric(15, 2),
  amount numeric(15, 2),
  measurement text NOT NULL DEFAULT '',
  assumptions text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  row_status row_status NOT NULL DEFAULT 'Final',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. AddOn Configs table
CREATE TABLE IF NOT EXISTS addon_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL UNIQUE REFERENCES estimates(id) ON DELETE CASCADE,
  prelims_pct numeric(5, 2) NOT NULL DEFAULT 10.00,
  contingency_pct numeric(5, 2) NOT NULL DEFAULT 5.00,
  profit_pct numeric(5, 2) NOT NULL DEFAULT 10.00,
  tax_pct numeric(5, 2) NOT NULL DEFAULT 6.00,
  rounding_rule integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_percentages CHECK (
    prelims_pct >= 0 AND prelims_pct <= 100 AND
    contingency_pct >= 0 AND contingency_pct <= 100 AND
    profit_pct >= 0 AND profit_pct <= 100 AND
    tax_pct >= 0 AND tax_pct <= 100
  )
);

-- 7. Row Comments table
CREATE TABLE IF NOT EXISTS row_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_row_id uuid NOT NULL REFERENCES boq_rows(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id),
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. AI Runs table (Phase 2 ready)
CREATE TABLE IF NOT EXISTS ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  sow_version_id uuid NOT NULL REFERENCES sow_versions(id) ON DELETE CASCADE,
  output_boq_version_id uuid REFERENCES boq_versions(id) ON DELETE SET NULL,
  model_name text NOT NULL DEFAULT '',
  prompt_context jsonb NOT NULL DEFAULT '{}',
  output_json jsonb NOT NULL DEFAULT '{}',
  status ai_run_status NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_by_user_id uuid REFERENCES users(id),
  accepted_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimates_owner ON estimates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_sow_versions_estimate ON sow_versions(estimate_id);
CREATE INDEX IF NOT EXISTS idx_sow_versions_current ON sow_versions(estimate_id, is_current);
CREATE INDEX IF NOT EXISTS idx_boq_versions_estimate ON boq_versions(estimate_id);
CREATE INDEX IF NOT EXISTS idx_boq_versions_frozen ON boq_versions(estimate_id, is_frozen);
CREATE INDEX IF NOT EXISTS idx_boq_rows_version ON boq_rows(boq_version_id);
CREATE INDEX IF NOT EXISTS idx_boq_rows_sort ON boq_rows(boq_version_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_row_comments_row ON row_comments(boq_row_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_estimate ON audit_logs(estimate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_estimate ON ai_runs(estimate_id);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE row_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for estimates table
CREATE POLICY "Users can view all estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create estimates"
  ON estimates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own estimates"
  ON estimates FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own estimates"
  ON estimates FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- RLS Policies for sow_versions table
CREATE POLICY "Users can view SOW versions of accessible estimates"
  ON sow_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = sow_versions.estimate_id
    )
  );

CREATE POLICY "Users can create SOW versions"
  ON sow_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = sow_versions.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update SOW versions"
  ON sow_versions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = sow_versions.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = sow_versions.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );

-- RLS Policies for boq_versions table
CREATE POLICY "Users can view BoQ versions"
  ON boq_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = boq_versions.estimate_id
    )
  );

CREATE POLICY "Users can create BoQ versions"
  ON boq_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = boq_versions.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update BoQ versions"
  ON boq_versions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = boq_versions.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = boq_versions.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );

-- RLS Policies for boq_rows table
CREATE POLICY "Users can view BoQ rows"
  ON boq_rows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boq_versions
      JOIN estimates ON estimates.id = boq_versions.estimate_id
      WHERE boq_versions.id = boq_rows.boq_version_id
    )
  );

CREATE POLICY "Users can create BoQ rows"
  ON boq_rows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boq_versions
      JOIN estimates ON estimates.id = boq_versions.estimate_id
      WHERE boq_versions.id = boq_rows.boq_version_id
      AND estimates.owner_user_id = auth.uid()
      AND boq_versions.is_frozen = false
    )
  );

CREATE POLICY "Users can update BoQ rows"
  ON boq_rows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boq_versions
      JOIN estimates ON estimates.id = boq_versions.estimate_id
      WHERE boq_versions.id = boq_rows.boq_version_id
      AND estimates.owner_user_id = auth.uid()
      AND boq_versions.is_frozen = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boq_versions
      JOIN estimates ON estimates.id = boq_versions.estimate_id
      WHERE boq_versions.id = boq_rows.boq_version_id
      AND estimates.owner_user_id = auth.uid()
      AND boq_versions.is_frozen = false
    )
  );

CREATE POLICY "Users can delete BoQ rows"
  ON boq_rows FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boq_versions
      JOIN estimates ON estimates.id = boq_versions.estimate_id
      WHERE boq_versions.id = boq_rows.boq_version_id
      AND estimates.owner_user_id = auth.uid()
      AND boq_versions.is_frozen = false
    )
  );

-- RLS Policies for addon_configs table
CREATE POLICY "Users can view addon configs"
  ON addon_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = addon_configs.estimate_id
    )
  );

CREATE POLICY "Users can create addon configs"
  ON addon_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = addon_configs.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update addon configs"
  ON addon_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = addon_configs.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = addon_configs.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );

-- RLS Policies for row_comments table
CREATE POLICY "Users can view comments"
  ON row_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boq_rows
      JOIN boq_versions ON boq_versions.id = boq_rows.boq_version_id
      JOIN estimates ON estimates.id = boq_versions.estimate_id
      WHERE boq_rows.id = row_comments.boq_row_id
    )
  );

CREATE POLICY "Users can create comments"
  ON row_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boq_rows
      JOIN boq_versions ON boq_versions.id = boq_rows.boq_version_id
      JOIN estimates ON estimates.id = boq_versions.estimate_id
      WHERE boq_rows.id = row_comments.boq_row_id
    )
  );

-- RLS Policies for audit_logs table (read-only after creation)
CREATE POLICY "Users can view audit logs for accessible estimates"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = audit_logs.estimate_id
    )
  );

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for ai_runs table
CREATE POLICY "Users can view AI runs"
  ON ai_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = ai_runs.estimate_id
    )
  );

CREATE POLICY "Users can create AI runs"
  ON ai_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = ai_runs.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update AI runs"
  ON ai_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = ai_runs.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimates
      WHERE estimates.id = ai_runs.estimate_id
      AND estimates.owner_user_id = auth.uid()
    )
  );