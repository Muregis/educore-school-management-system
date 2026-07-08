-- Add version column to schools table to fix trigger error
-- This is needed because the update_updated_at_column() trigger tries to increment version

ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create trigger function for schools that doesn't use version (safer approach)
CREATE OR REPLACE FUNCTION update_schools_updated_at_only()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger and create new one
DROP TRIGGER IF EXISTS update_schools_updated_at ON schools;

CREATE TRIGGER update_schools_updated_at
    BEFORE UPDATE ON schools
    FOR EACH ROW
    EXECUTE FUNCTION update_schools_updated_at_only();
