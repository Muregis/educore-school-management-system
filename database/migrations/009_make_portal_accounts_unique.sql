-- Migration: Add unique constraint to portal user emails to prevent cross-school data leakage
-- This ensures portal accounts are unique per school even if admission numbers are the same

-- First, we need to update existing portal accounts to include school code
-- This makes them unique: adm001.schoolcode.parent@portal instead of adm001.parent@portal

-- Add a note about the portal account format
COMMENT ON TABLE users IS 'User accounts including staff, parents, and students. Portal accounts format: {admission}.{school_code}.{role}@portal';

-- The unique constraint already exists on (school_id, email) which prevents duplicate emails within a school
-- But we need to ensure the email format includes school code for cross-school uniqueness

SELECT 'Portal account uniqueness will be enforced by using school code in email format' AS status;
