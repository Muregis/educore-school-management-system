-- Migration: Add WhatsApp Business number to schools table
-- Phase 2: Per-school WhatsApp Business app migration

-- Add whatsapp_business_number column to schools table
ALTER TABLE schools 
ADD COLUMN whatsapp_business_number VARCHAR(40) NULL;

-- Add comment for documentation
COMMENT ON COLUMN schools.whatsapp_business_number IS 'WhatsApp Business number for payment receipts (format: 2547xxxxxxxx or +2547xxxxxxxx)';

-- Add index for performance
CREATE INDEX idx_schools_whatsapp_number ON schools(whatsapp_business_number);

SELECT 'WhatsApp Business number column added to schools table successfully' AS status;
