-- Create academic_terms table for comprehensive term management
-- This table enables proper term lifecycle management, transitions, and data archiving

CREATE TABLE IF NOT EXISTS academic_terms (
  term_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  term_name VARCHAR(50) NOT NULL, -- e.g., "Term 1", "Term 2", "Term 3"
  academic_year VARCHAR(10) NOT NULL, -- e.g., "2024", "2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'closed', 'locked')),
  is_current BOOLEAN DEFAULT FALSE,
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination of term name, year, and school
  CONSTRAINT unique_term_per_school UNIQUE (school_id, term_name, academic_year)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_academic_terms_school_id ON academic_terms(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_terms_status ON academic_terms(status);
CREATE INDEX IF NOT EXISTS idx_academic_terms_is_current ON academic_terms(is_current);
CREATE INDEX IF NOT EXISTS idx_academic_terms_dates ON academic_terms(start_date, end_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_academic_terms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_academic_terms_updated_at ON academic_terms;

CREATE TRIGGER trigger_update_academic_terms_updated_at
  BEFORE UPDATE ON academic_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_academic_terms_updated_at();

-- Add comment to table
COMMENT ON TABLE academic_terms IS 'Manages academic term lifecycle including creation, activation, closing, and transitions';
COMMENT ON COLUMN academic_terms.term_name IS 'Name of the term (e.g., Term 1, Term 2, Term 3)';
COMMENT ON COLUMN academic_terms.academic_year IS 'Academic year (e.g., 2024, 2025)';
COMMENT ON COLUMN academic_terms.status IS 'Term status: upcoming, active, closed, or locked';
COMMENT ON COLUMN academic_terms.is_current IS 'Whether this is the currently active term for the school';
COMMENT ON COLUMN academic_terms.closed_at IS 'Timestamp when term was closed';
COMMENT ON COLUMN academic_terms.closed_by IS 'User ID who closed the term';
