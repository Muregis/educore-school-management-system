-- Migration: Add TSC Staff ID to teachers table
-- Date: 2026-03-20
-- Purpose: Add unique teacher identification number for better tracking

-- Add the new column
ALTER TABLE public.teachers 
ADD COLUMN tsc_staff_id VARCHAR(60) NULL UNIQUE;

-- Add comment
COMMENT ON COLUMN public.teachers.tsc_staff_id IS 'Unique TSC/Staff ID number for teacher identification';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_teachers_tsc_staff_id 
ON public.teachers (tsc_staff_id) WHERE tsc_staff_id IS NOT NULL;

-- Add unique constraint for school + tsc_staff_id combination
ALTER TABLE public.teachers 
ADD CONSTRAINT uq_teachers_school_tsc 
UNIQUE (school_id, tsc_staff_id) WHERE tsc_staff_id IS NOT NULL;
