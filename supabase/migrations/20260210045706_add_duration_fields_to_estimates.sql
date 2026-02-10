/*
  # Add Duration Fields to Estimates Table

  1. Changes
    - Add `duration_value` column (integer, nullable) to store numeric duration
    - Add `duration_unit` column (text, nullable) to store unit (weeks/months/years)
  
  2. Notes
    - These fields are optional to maintain backward compatibility
    - Existing estimates will have NULL values for these fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'duration_value'
  ) THEN
    ALTER TABLE estimates ADD COLUMN duration_value integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'duration_unit'
  ) THEN
    ALTER TABLE estimates ADD COLUMN duration_unit text;
  END IF;
END $$;
