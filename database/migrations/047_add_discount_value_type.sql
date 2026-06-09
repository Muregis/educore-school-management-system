-- Migration: 047_add_discount_value_type
-- Description: Add discount_value_type column to student_discounts table to support fixed amount discounts

-- Add discount_value_type column to student_discounts
ALTER TABLE student_discounts 
ADD COLUMN IF NOT EXISTS discount_value_type VARCHAR(20) DEFAULT 'percentage';

-- Add constraint to ensure only valid values
ALTER TABLE student_discounts 
ADD CONSTRAINT chk_discount_value_type 
CHECK (discount_value_type IN ('percentage', 'fixed'));

-- Update existing records to have percentage as default (backward compatibility)
UPDATE student_discounts 
SET discount_value_type = 'percentage' 
WHERE discount_value_type IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_student_discounts_value_type 
ON student_discounts(discount_value_type);

COMMENT ON COLUMN student_discounts.discount_value_type IS 'Type of discount: percentage (%) or fixed amount (KES)';

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_student_discounts_value_type;
-- ALTER TABLE student_discounts DROP CONSTRAINT IF EXISTS chk_discount_value_type;
-- ALTER TABLE student_discounts DROP COLUMN IF EXISTS discount_value_type;
