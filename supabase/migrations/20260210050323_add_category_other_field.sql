/*
  # Add category_other field for custom category specification

  1. Changes
    - Add `category_other` column to `estimates` table
      - Type: text (nullable)
      - Stores custom category text when "Others" is selected
    
  2. Notes
    - Nullable to maintain backward compatibility with existing records
    - Only populated when category = 'Others'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'estimates'
    AND column_name = 'category_other'
  ) THEN
    ALTER TABLE estimates ADD COLUMN category_other text;
  END IF;
END $$;