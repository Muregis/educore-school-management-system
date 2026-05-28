-- =====================================================
-- Create exam_types table for managing exam types per school
-- This allows schools to configure different exam types
-- (e.g., Opener, Mid-Term, End-Term, CATs, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS exam_types (
  exam_type_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  exam_name VARCHAR(100) NOT NULL,
  exam_sequence INTEGER NOT NULL DEFAULT 1,
  weight_percentage DECIMAL(5,2) DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, exam_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_exam_types_school_active
ON exam_types(school_id, is_active)
WHERE is_active = TRUE;

-- Create index for ordering by sequence
CREATE INDEX IF NOT EXISTS idx_exam_types_sequence
ON exam_types(school_id, exam_sequence);

-- Add comment
COMMENT ON TABLE exam_types IS 'Configurable exam types per school (e.g., Opener, Mid-Term, End-Term)';
COMMENT ON COLUMN exam_types.exam_sequence IS 'Order for display and weighted average calculation';
COMMENT ON COLUMN exam_types.weight_percentage IS 'Weight for this exam type in final grade (default 100%)';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_exam_types_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_exam_types_update ON exam_types;
CREATE TRIGGER on_exam_types_update
BEFORE UPDATE ON exam_types
FOR EACH ROW
EXECUTE FUNCTION update_exam_types_timestamp();

-- Seed default exam types for existing schools
-- This will be called by the backend when needed
