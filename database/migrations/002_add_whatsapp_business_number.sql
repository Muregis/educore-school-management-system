-- Migration: Add WhatsApp Business number to schools table
-- Phase 2: Per-school WhatsApp Business app migration
-- Usage: psql -d your_database_name -f 002_add_whatsapp_business_number.sql

-- Add whatsapp_business_number column only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'whatsapp_business_number'
    ) THEN
        ALTER TABLE schools 
        ADD COLUMN whatsapp_business_number VARCHAR(40) NULL;
        
        COMMENT ON COLUMN schools.whatsapp_business_number IS 'WhatsApp Business number for payment receipts (format: 2547xxxxxxxx or +2547xxxxxxxx)';
        
        CREATE INDEX idx_schools_whatsapp_number ON schools(whatsapp_business_number);
        
        RAISE NOTICE 'WhatsApp Business number column added successfully';
    ELSE
        RAISE NOTICE 'WhatsApp Business number column already exists';
    END IF;
END $$;

-- Verify the column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'schools' AND column_name = 'whatsapp_business_number';
