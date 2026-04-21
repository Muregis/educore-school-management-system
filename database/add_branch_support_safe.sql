-- SAFE MIGRATION: Add Branch/Campus Support
-- WARNING: This ONLY adds new columns - NOTHING is deleted
-- Run in Supabase SQL Editor

-- 1. Add parent school reference (self-referencing for branches)
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS parent_school_id BIGINT NULL 
REFERENCES public.schools(school_id);

-- 2. Add flag to identify branches
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS is_branch BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Add branch code for identification
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS branch_code VARCHAR(40) NULL;

-- 4. Add unique constraint: one branch code per parent school
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_schools_parent_branch'
  ) THEN
    ALTER TABLE public.schools 
    ADD CONSTRAINT uq_schools_parent_branch 
    UNIQUE (parent_school_id, branch_code);
  END IF;
END $$;

-- 5. Add index for fast branch lookups
CREATE INDEX IF NOT EXISTS idx_schools_parent 
ON public.schools (parent_school_id);

-- 6. Add index to quickly find all branches of a school
CREATE INDEX IF NOT EXISTS idx_schools_is_branch 
ON public.schools (is_branch) 
WHERE is_branch = TRUE;

-- 7. Add branch location details
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS branch_address VARCHAR(255) NULL;

ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS branch_phone VARCHAR(40) NULL;

-- 8. Add branch manager reference
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS branch_manager_id BIGINT NULL 
REFERENCES public.users(user_id);

-- Done! All changes are additive only - no data was deleted.
