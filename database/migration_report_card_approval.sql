-- Add approval fields to report_cards table
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS approved_by VARCHAR(160) NULL;
ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL;