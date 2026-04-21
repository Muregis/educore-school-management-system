-- Add director role to user roles
-- Run this in Supabase SQL Editor

-- First, check current enum values
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype;

-- Add director to user_role enum (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'director' 
    AND enumtypid = 'user_role'::regtype
  ) THEN
    ALTER TYPE user_role ADD VALUE 'director';
  END IF;
END $$;

-- Alternative: If user_role enum doesn't exist, you may need to alter the column type
-- Check what the role column type is:
-- SELECT data_type FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'role';

-- If role is VARCHAR/text, no migration needed - just use 'director'
-- If role is ENUM, run the above DO block
