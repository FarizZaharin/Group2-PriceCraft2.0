/*
  # Admin Settings Tables

  1. New Tables
    - `admin_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique) - setting identifier
      - `value` (jsonb) - setting value (flexible)
      - `updated_by` (uuid, FK users) - last editor
      - `updated_at` (timestamptz) - last update time
    - `categories`
      - `id` (uuid, primary key)
      - `name` (text, unique) - category display name
      - `sort_order` (integer) - display order
      - `is_active` (boolean) - soft-delete support
      - `created_at` (timestamptz)
    - `uom_library`
      - `id` (uuid, primary key)
      - `code` (text, unique) - short code e.g. "m2"
      - `label` (text) - display label e.g. "Square Metre"
      - `sort_order` (integer) - display order
      - `is_active` (boolean) - soft-delete support
      - `created_at` (timestamptz)
    - `section_templates`
      - `id` (uuid, primary key)
      - `name` (text) - template name
      - `description` (text) - brief description
      - `created_by` (uuid, FK users)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `section_template_rows`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK section_templates)
      - `row_type` (row_type enum)
      - `section` (text)
      - `description` (text)
      - `uom` (text)
      - `category` (text)
      - `sort_order` (integer)

  2. Security
    - Enable RLS on all new tables
    - Authenticated users can read all settings, categories, UOMs, and templates
    - Only admin users can insert/update/delete

  3. Seed Data
    - Default global settings (currency, tax, rounding, default add-on percentages)
    - Standard categories (Prelims, Labour, Material, Equipment, Subcon, Other)
    - Standard UOMs (LS, m, m2, m3, unit, lot, day, hour, kg, tonne)

  4. Notes
    - admin_settings uses a key-value pattern for flexible configuration
    - Categories and UOMs support soft-delete via is_active flag
    - Section templates allow pre-built BoQ section patterns
*/

-- admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read admin settings"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert admin settings"
  ON admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update admin settings"
  ON admin_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- uom_library table
CREATE TABLE IF NOT EXISTS uom_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE uom_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read UOMs"
  ON uom_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert UOMs"
  ON uom_library FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update UOMs"
  ON uom_library FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete UOMs"
  ON uom_library FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- section_templates table
CREATE TABLE IF NOT EXISTS section_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE section_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read section templates"
  ON section_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert section templates"
  ON section_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update section templates"
  ON section_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete section templates"
  ON section_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- section_template_rows table
CREATE TABLE IF NOT EXISTS section_template_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES section_templates(id) ON DELETE CASCADE,
  row_type row_type NOT NULL DEFAULT 'LineItem',
  section text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  uom text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE section_template_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read template rows"
  ON section_template_rows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert template rows"
  ON section_template_rows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update template rows"
  ON section_template_rows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete template rows"
  ON section_template_rows FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Seed default admin_settings
INSERT INTO admin_settings (key, value) VALUES
  ('default_currency', '"MYR"'::jsonb),
  ('default_tax_percent', '6.0'::jsonb),
  ('rounding_decimals', '2'::jsonb),
  ('default_prelims_pct', '10.0'::jsonb),
  ('default_contingency_pct', '5.0'::jsonb),
  ('default_profit_pct', '10.0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed default categories
INSERT INTO categories (name, sort_order) VALUES
  ('Prelims', 0),
  ('Labour', 1),
  ('Material', 2),
  ('Equipment', 3),
  ('Subcon', 4),
  ('Other', 5)
ON CONFLICT (name) DO NOTHING;

-- Seed default UOMs
INSERT INTO uom_library (code, label, sort_order) VALUES
  ('LS', 'Lump Sum', 0),
  ('m', 'Metre', 1),
  ('m2', 'Square Metre', 2),
  ('m3', 'Cubic Metre', 3),
  ('unit', 'Unit', 4),
  ('lot', 'Lot', 5),
  ('day', 'Day', 6),
  ('hour', 'Hour', 7),
  ('kg', 'Kilogram', 8),
  ('tonne', 'Tonne', 9)
ON CONFLICT (code) DO NOTHING;
