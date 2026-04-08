-- Migration: Add M-Pesa auto-reconciliation tables
-- Track unmatched payments and allow manual reconciliation

-- Table for unmatched M-Pesa payments (when billRef doesn't match any student)
CREATE TABLE IF NOT EXISTS mpesa_unmatched (
  id                BIGSERIAL PRIMARY KEY,
  school_id         BIGINT REFERENCES schools(school_id),
  transaction_id    VARCHAR(60) NOT NULL UNIQUE,
  amount            NUMERIC(12,2) NOT NULL,
  phone_number      VARCHAR(40),
  bill_ref_number   VARCHAR(60),
  raw_payload       JSONB,
  matched_student_id BIGINT REFERENCES students(student_id),
  matched_at        TIMESTAMP WITH TIME ZONE,
  matched_by        BIGINT REFERENCES users(user_id),
  status            VARCHAR(20) NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'ignored')),
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_school ON mpesa_unmatched(school_id, status);
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_transid ON mpesa_unmatched(transaction_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_unmatched_billref ON mpesa_unmatched(bill_ref_number);

-- Comments
COMMENT ON TABLE mpesa_unmatched IS 'M-Pesa payments that could not be auto-matched to students. Finance staff can manually reconcile these.';
COMMENT ON COLUMN mpesa_unmatched.bill_ref_number IS 'The account number entered by payer (should be student admission number)';
COMMENT ON COLUMN mpesa_unmatched.raw_payload IS 'Full M-Pesa callback payload for audit trail';

-- Add reconciliation log table
CREATE TABLE IF NOT EXISTS mpesa_reconciliation_logs (
  id                BIGSERIAL PRIMARY KEY,
  school_id         BIGINT NOT NULL REFERENCES schools(school_id),
  unmatched_id      BIGINT REFERENCES mpesa_unmatched(id),
  student_id        BIGINT REFERENCES students(student_id),
  payment_id        BIGINT REFERENCES payments(payment_id),
  action            VARCHAR(20) NOT NULL CHECK (action IN ('match', 'ignore', 'unignore')),
  performed_by      BIGINT REFERENCES users(user_id),
  notes             TEXT,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recon_logs_school ON mpesa_reconciliation_logs(school_id);

COMMENT ON TABLE mpesa_reconciliation_logs IS 'Audit trail for manual M-Pesa reconciliation actions';

SELECT 'M-Pesa reconciliation tables created successfully' AS status;
