-- Migration: Add proof_url column to payments table
-- Purpose: Store URL of uploaded payment proof (receipts, deposit slips, etc.)
-- Usage: psql -d your_database_name -f 008_add_payment_proof_url.sql

-- Add proof_url column only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'proof_url'
    ) THEN
        ALTER TABLE payments 
        ADD COLUMN proof_url TEXT NULL;
        -
        COMMENT ON COLUMN payments.proof_url IS 'URL to uploaded payment proof (receipt, deposit slip, etc.) stored in Supabase Storage';
        
        RAISE NOTICE 'proof_url column added to payments table successfully';
    ELSE
        RAISE NOTICE 'proof_url column already exists in payments table';
    END IF;
END $$;

-- Verify column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'proof_url';
