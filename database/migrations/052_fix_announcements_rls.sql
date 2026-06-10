-- Migration: Fix announcements RLS policies
-- This migration fixes the RLS policies for announcements table to ensure proper access

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_announcements ON public.announcements;
DROP POLICY IF EXISTS select_announcements_school ON public.announcements;
DROP POLICY IF EXISTS insert_announcements_school ON public.announcements;
DROP POLICY IF EXISTS update_announcements_school ON public.announcements;
DROP POLICY IF EXISTS delete_announcements_school ON public.announcements;

-- Create proper RLS policies for tenant isolation
CREATE POLICY tenant_isolation_announcements
  ON public.announcements
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id)
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Policy for allowing authenticated users to read announcements from their school
CREATE POLICY select_announcements_school
  ON public.announcements FOR SELECT
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Policy for allowing authenticated users to insert announcements for their school
CREATE POLICY insert_announcements_school
  ON public.announcements FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Policy for allowing authenticated users to update announcements for their school
CREATE POLICY update_announcements_school
  ON public.announcements FOR UPDATE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- Policy for allowing authenticated users to delete announcements for their school
CREATE POLICY delete_announcements_school
  ON public.announcements FOR DELETE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);
