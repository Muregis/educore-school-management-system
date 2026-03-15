-- Migration: Create student_ledger table for fee balance tracking
-- Critical for proper financial management

-- Create student_ledger table (PostgreSQL syntax)
CREATE TABLE IF NOT EXISTS student_ledger (
  ledger_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('charge','payment','adjustment')),
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id BIGINT NULL,
  description TEXT NULL,
  receipt_number VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ledger_student ON student_ledger(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_ledger_receipt ON student_ledger(receipt_number);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON student_ledger(transaction_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON student_ledger(reference_type, reference_id);

-- Add unique constraint for receipt numbers
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_receipt ON student_ledger(receipt_number) WHERE receipt_number IS NOT NULL;

-- Add RLS policy for tenant isolation
ALTER TABLE student_ledger ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see ledger entries from their own school
CREATE POLICY student_ledger_school_isolation ON student_ledger
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Add foreign key constraints (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students') THEN
        ALTER TABLE student_ledger 
        ADD CONSTRAINT fk_ledger_student 
        FOREIGN KEY (student_id) REFERENCES students(student_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') THEN
        ALTER TABLE student_ledger 
        ADD CONSTRAINT fk_ledger_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id);
    END IF;
END $$;

COMMENT ON TABLE student_ledger IS 'Financial ledger tracking all student fee transactions and balances';
COMMENT ON COLUMN student_ledger.transaction_type IS 'Type: charge=fee assessed, payment=payment received, adjustment=manual correction';
COMMENT ON COLUMN student_ledger.balance_after IS 'Running balance after this transaction';
COMMENT ON COLUMN student_ledger.receipt_number IS 'Unique receipt number for payments (format: REC-YYYY-MMDD-XXXX)';
