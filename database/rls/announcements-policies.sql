-- =====================================================
-- ANNOUNCEMENTS TABLE RLS POLICIES
-- =====================================================
-- Row Level Security policies for announcements table
-- Ensures tenant isolation for school announcements

-- Enable RLS on announcements table
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy for reading announcements from user's school only
CREATE POLICY announcements_read_policy
  ON public.announcements FOR SELECT
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Policy for inserting announcements for user's school only
CREATE POLICY announcements_insert_policy
  ON public.announcements FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Policy for updating announcements in user's school only
CREATE POLICY announcements_update_policy
  ON public.announcements FOR UPDATE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id)
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Policy for deleting announcements in user's school only
CREATE POLICY announcements_delete_policy
  ON public.announcements FOR DELETE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_announcements_school_id 
  ON public.announcements (school_id);

-- Verify policies are applied
SELECT tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename = 'announcements'
ORDER BY cmd, policyname;
