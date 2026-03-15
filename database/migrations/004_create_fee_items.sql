-- Migration: Create fee_items table for detailed fee structures
-- Enhances the existing fee_structures table for better fee management

-- Create fee_items table (PostgreSQL syntax)
CREATE TABLE IF NOT EXISTS fee_items (
  fee_item_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  fee_structure_id BIGINT NULL,
  item_name VARCHAR(100) NOT NULL,
  item_type VARCHAR(50) DEFAULT 'tuition' CHECK (item_type IN ('tuition','activity','transport','misc','exam')),
  amount DECIMAL(12,2) NOT NULL,
  is_optional BOOLEAN DEFAULT FALSE,
  due_date DATE NULL,
  academic_year VARCHAR(20) DEFAULT '2026',
  term VARCHAR(40) DEFAULT 'Term 2',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_fee_items_structure ON fee_items(fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_fee_items_school ON fee_items(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_items_type ON fee_items(item_type);
CREATE INDEX IF NOT EXISTS idx_fee_items_optional ON fee_items(is_optional);

-- Add RLS policy for tenant isolation
ALTER TABLE fee_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see fee items from their own school
CREATE POLICY fee_items_school_isolation ON fee_items
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Add foreign key constraints (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_structures') THEN
        ALTER TABLE fee_items 
        ADD CONSTRAINT fk_fee_items_structure 
        FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(fee_structure_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') THEN
        ALTER TABLE fee_items 
        ADD CONSTRAINT fk_fee_items_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id);
    END IF;
END $$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fee_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_fee_items_updated_at
    BEFORE UPDATE ON fee_items
    FOR EACH ROW
    EXECUTE FUNCTION update_fee_items_updated_at();

COMMENT ON TABLE fee_items IS 'Detailed fee items for flexible fee structures';
COMMENT ON COLUMN fee_items.item_type IS 'Type of fee: tuition, activity, transport, misc, exam';
COMMENT ON COLUMN fee_items.is_optional IS 'Whether this fee item is optional for students';
COMMENT ON COLUMN fee_items.due_date IS 'Due date for this fee item (if applicable)';
