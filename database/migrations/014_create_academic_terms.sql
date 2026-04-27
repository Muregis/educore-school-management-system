-- Migration: Create academic_terms table for term lifecycle management
-- This enables proper term state tracking and prevents modification of closed terms

CREATE TABLE IF NOT EXISTS academic_terms (
  term_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  term_name VARCHAR(20) NOT NULL CHECK (term_name IN ('Term 1', 'Term 2', 'Term 3')),
  academic_year SMALLINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'closed', 'locked')),
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, term_name, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_academic_terms_school ON academic_terms(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_terms_current ON academic_terms(school_id, is_current);
CREATE INDEX IF NOT EXISTS idx_academic_terms_dates ON academic_terms(start_date, end_date);

-- RLS for tenant isolation
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY academic_terms_school_isolation ON academic_terms
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_academic_term_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_academic_term_timestamp_trigger
  BEFORE UPDATE ON academic_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_academic_term_timestamp();

COMMENT ON TABLE academic_terms IS 'Academic term lifecycle with state management';
COMMENT ON COLUMN academic_terms.status IS 'State: upcoming, active, closed, locked';
COMMENT ON COLUMN academic_terms.is_current IS 'Flag for currently active term';
