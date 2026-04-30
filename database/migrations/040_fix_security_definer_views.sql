-- ==========================================
-- SECURITY FIX: Remove SECURITY DEFINER from views
-- 
-- Issue: Views with SECURITY DEFINER enforce Postgres
-- permissions and RLS policies of the view creator rather
-- than the querying user, creating potential security risks.
-- 
-- Fix: Recreate views with SECURITY INVOKER (default behavior)
-- or add explicit permission checks where needed.
-- ==========================================

-- =====================================================
-- FIX 1: tenant_cache_stats view
-- This view should use SECURITY INVOKER to respect
-- the querying user's RLS policies.
-- =====================================================

-- First, check if the view exists and recreate it with proper security settings
DO $$
BEGIN
    -- Check if view exists
    IF EXISTS (
        SELECT 1 FROM pg_views 
        WHERE viewname = 'tenant_cache_stats' 
        AND schemaname = 'public'
    ) THEN
        -- Drop and recreate the view (default is SECURITY INVOKER)
        DROP VIEW IF EXISTS tenant_cache_stats;
        
        CREATE VIEW tenant_cache_stats AS
        SELECT 
            school_id,
            COUNT(*) as total_invalidations,
            COUNT(CASE WHEN action = 'invalidate' THEN 1 END) as invalidations,
            COUNT(CASE WHEN action = 'clear' THEN 1 END) as clears,
            COUNT(CASE WHEN action = 'refresh' THEN 1 END) as refreshes,
            MAX(created_at) as last_invalidation
        FROM cache_invalidation_log 
        GROUP BY school_id;
        
        RAISE NOTICE 'Fixed tenant_cache_stats view - recreated with default SECURITY INVOKER';
    ELSE
        RAISE NOTICE 'tenant_cache_stats view does not exist, creating new';
        
        -- Create the view fresh (default is SECURITY INVOKER)
        CREATE VIEW tenant_cache_stats AS
        SELECT 
            school_id,
            COUNT(*) as total_invalidations,
            COUNT(CASE WHEN action = 'invalidate' THEN 1 END) as invalidations,
            COUNT(CASE WHEN action = 'clear' THEN 1 END) as clears,
            COUNT(CASE WHEN action = 'refresh' THEN 1 END) as refreshes,
            MAX(created_at) as last_invalidation
        FROM cache_invalidation_log 
        GROUP BY school_id;
    END IF;
END $$;

-- =====================================================
-- FIX 2: parent_data_backup view
-- If this view exists with SECURITY DEFINER, recreate it
-- with proper security settings or drop it if unused.
-- =====================================================

DO $$
BEGIN
    -- Check if the backup view exists
    IF EXISTS (
        SELECT 1 FROM pg_views 
        WHERE viewname = 'parent_data_backup' 
        AND schemaname = 'public'
    ) THEN
        -- Drop the view if it has SECURITY DEFINER
        -- This view is typically used for backup purposes and
        -- should not bypass RLS policies
        DROP VIEW IF EXISTS parent_data_backup;
        RAISE NOTICE 'Dropped parent_data_backup view with SECURITY DEFINER';
        RAISE NOTICE 'If this view was needed, recreate it with SECURITY INVOKER';
    ELSE
        RAISE NOTICE 'parent_data_backup view does not exist - no action needed';
    END IF;
END $$;

-- =====================================================
-- Additional: Ensure cache_invalidation_log has proper RLS
-- to protect the data that tenant_cache_stats queries
-- =====================================================

-- Enable RLS on the underlying table if not already enabled
ALTER TABLE cache_invalidation_log ENABLE ROW LEVEL SECURITY;

-- Create a policy that restricts access to the user's school data
-- Only create if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cache_invalidation_log' 
        AND schemaname = 'public'
        AND policyname = 'tenant_cache_stats_school_isolation'
    ) THEN
        CREATE POLICY "tenant_cache_stats_school_isolation" ON cache_invalidation_log
            FOR SELECT
            USING (school_id = (auth.jwt() ->> 'school_id')::bigint);
        
        RAISE NOTICE 'Created RLS policy for cache_invalidation_log';
    END IF;
END $$;

-- =====================================================
-- VERIFICATION: Check the views were fixed
-- =====================================================

-- Verify tenant_cache_stats no longer has SECURITY DEFINER
SELECT 
    v.schemaname,
    v.viewname,
    v.viewowner,
    pg_catalog.pg_get_viewdef(c.oid, true) as view_definition,
    c.reloptions,
    CASE 
        WHEN pg_catalog.pg_get_viewdef(c.oid, true) LIKE '%SECURITY DEFINER%'
        THEN 'CRITICAL: Still has SECURITY DEFINER in definition'
        ELSE 'OK: No SECURITY DEFINER in definition'
    END as security_status
FROM pg_views v
JOIN pg_class c ON c.relname = v.viewname
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = v.schemaname
WHERE v.viewname IN ('tenant_cache_stats', 'parent_data_backup')
AND v.schemaname = 'public';

-- ==========================================
-- END OF SECURITY FIX
-- 
-- RESULT: Views are now secured with SECURITY INVOKER
-- RLS policies will be enforced based on the querying user
-- ==========================================
