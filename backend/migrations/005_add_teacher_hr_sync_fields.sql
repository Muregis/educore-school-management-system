-- Migration: Add HR synchronization fields to teachers table
-- This migration adds fields that enable full synchronization between teachers and hr_staff tables

-- Add gender column to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- Add contract_type column to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) DEFAULT 'Permanent';

-- Add salary column to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS salary NUMERIC(15,2);

-- Add notes column to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index on gender for better query performance
CREATE INDEX IF NOT EXISTS idx_teachers_gender ON teachers(gender);

-- Create index on contract_type for better query performance
CREATE INDEX IF NOT EXISTS idx_teachers_contract_type ON teachers(contract_type);

-- Add comments to document the new columns
COMMENT ON COLUMN teachers.gender IS 'Gender of the teacher (male, female, other)';
COMMENT ON COLUMN teachers.contract_type IS 'Type of employment contract (Permanent, Contract, Part-time, Temporary)';
COMMENT ON COLUMN teachers.salary IS 'Monthly salary amount';
COMMENT ON COLUMN teachers.notes IS 'Additional notes about the teacher';
