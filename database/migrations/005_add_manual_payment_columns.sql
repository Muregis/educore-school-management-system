-- Add missing columns to payments table for manual payment methods
-- Migration: 005_add_manual_payment_columns
-- Description: Add columns for cash, bank transfer, and M-Pesa manual payments
-- Also adds breakfast columns to students table

-- Add breakfast columns to students table (for breakfast program support)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS breakfast_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS breakfast_daily_rate DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS breakfast_days INTEGER DEFAULT 66,
ADD COLUMN IF NOT EXISTS breakfast_billing_type VARCHAR(20) DEFAULT 'daily';

-- Add columns for bank transfer
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);

-- Add columns for M-Pesa manual
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS mpesa_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS mpesa_phone VARCHAR(20);

-- Add columns for proof and notes
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS proof_url TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add column to track who recorded the payment
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS recorded_by BIGINT REFERENCES users(user_id);

-- Create fee balance update function
CREATE OR REPLACE FUNCTION update_fee_balance(
  p_student_id INTEGER,
  p_school_id INTEGER,
  p_amount DECIMAL
)
RETURNS void AS $$
BEGIN
  UPDATE fees
  SET 
    amount_paid = COALESCE(amount_paid, 0) + p_amount,
    balance = COALESCE(balance, 0) - p_amount,
    status = CASE 
      WHEN (COALESCE(balance, 0) - p_amount) <= 0 THEN 'paid'
      ELSE 'partial'
    END,
    updated_at = NOW()
  WHERE 
    student_id = p_student_id
    AND school_id = p_school_id
    AND status != 'paid'
    AND is_deleted = false;
END;
$$ LANGUAGE plpgsql;

-- ROLLBACK:
-- ALTER TABLE students DROP COLUMN IF EXISTS breakfast_enabled;
-- ALTER TABLE students DROP COLUMN IF EXISTS breakfast_daily_rate;
-- ALTER TABLE students DROP COLUMN IF EXISTS breakfast_days;
-- ALTER TABLE students DROP COLUMN IF EXISTS breakfast_billing_type;
-- ALTER TABLE payments DROP COLUMN IF EXISTS bank_name;
-- ALTER TABLE payments DROP COLUMN IF EXISTS account_number;
-- ALTER TABLE payments DROP COLUMN IF EXISTS mpesa_code;
-- ALTER TABLE payments DROP COLUMN IF EXISTS mpesa_phone;
-- ALTER TABLE payments DROP COLUMN IF EXISTS proof_url;
-- ALTER TABLE payments DROP COLUMN IF EXISTS notes;
-- ALTER TABLE payments DROP COLUMN IF EXISTS recorded_by;
-- DROP FUNCTION IF EXISTS update_fee_balance;
