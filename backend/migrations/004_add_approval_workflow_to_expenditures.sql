-- Migration: Add Approval Workflow and Enhanced Features to Expenditures
-- Date: 2026-05-18
-- Purpose: Add approval workflow, M-Pesa tracking, receipt support, and improved tracking

-- Add new columns to expenditures table
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS approval_timestamp TIMESTAMPTZ;
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS mpesa_code VARCHAR(50);
ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_expenditures_approval_status ON expenditures(school_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_expenditures_approved_by ON expenditures(approved_by);
CREATE INDEX IF NOT EXISTS idx_expenditures_mpesa_code ON expenditures(mpesa_code);

-- Comment for future use
COMMENT ON COLUMN expenditures.approval_status IS 'Approval workflow status: pending (default), approved, or rejected';
COMMENT ON COLUMN expenditures.mpesa_code IS 'M-Pesa transaction code for payment reference (e.g., UE2JE2N2SK)';
COMMENT ON COLUMN expenditures.receipt_url IS 'URL to uploaded receipt document (image or PDF)';
COMMENT ON COLUMN expenditures.rejection_reason IS 'Reason for rejection if approval_status = rejected';
