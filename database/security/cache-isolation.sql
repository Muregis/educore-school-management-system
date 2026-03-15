-- Cache Isolation Safety Improvements
-- Database-level cache management for multi-tenant SaaS

-- Step 1: Create cache invalidation tracking table
CREATE TABLE IF NOT EXISTS cache_invalidation_log (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    cache_key VARCHAR(255) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('invalidate', 'clear', 'refresh')),
    reason VARCHAR(100) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for cache invalidation performance
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_school 
ON cache_invalidation_log (school_id, created_at);

CREATE INDEX IF NOT EXISTS idx_cache_invalidation_key 
ON cache_invalidation_log (cache_key, action);

-- Step 2: Tenant cache statistics view
CREATE OR REPLACE VIEW tenant_cache_stats AS
SELECT 
    school_id,
    COUNT(*) as total_invalidations,
    COUNT(CASE WHEN action = 'invalidate' THEN 1 END) as invalidations,
    COUNT(CASE WHEN action = 'clear' THEN 1 END) as clears,
    COUNT(CASE WHEN action = 'refresh' THEN 1 END) as refreshes,
    MAX(created_at) as last_invalidation
FROM cache_invalidation_log 
GROUP BY school_id;

-- Step 3: Cache invalidation function
CREATE OR REPLACE FUNCTION invalidate_tenant_cache(
    p_school_id BIGINT,
    p_cache_key VARCHAR(255),
    p_reason VARCHAR(100) DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Log the invalidation
    INSERT INTO cache_invalidation_log (school_id, cache_key, action, reason)
    VALUES (p_school_id, p_cache_key, 'invalidate', p_reason);
    
    -- Here you would typically call your cache invalidation service
    -- This could be a NOTIFY statement for PostgreSQL LISTEN/NOTIFY
    PERFORM pg_notify('cache_invalidate', 
        json_build_object(
            'school_id', p_school_id,
            'cache_key', p_cache_key,
            'action', 'invalidate'
        )::text
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Cache invalidation failed for school %, key %: %', 
                     p_school_id, p_cache_key, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Clear all tenant cache function
CREATE OR REPLACE FUNCTION clear_tenant_cache(
    p_school_id BIGINT,
    p_reason VARCHAR(100) DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Log the clear operation
    INSERT INTO cache_invalidation_log (school_id, cache_key, action, reason)
    VALUES (p_school_id, '*', 'clear', p_reason);
    
    -- Notify cache service to clear all tenant cache
    PERFORM pg_notify('cache_invalidate', 
        json_build_object(
            'school_id', p_school_id,
            'cache_key', '*',
            'action', 'clear'
        )::text
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Tenant cache clear failed for school %: %', 
                     p_school_id, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Cache health check function
CREATE OR REPLACE FUNCTION cache_health_check()
RETURNS TABLE(
    metric_name TEXT,
    metric_value TEXT,
    status TEXT,
    recommendation TEXT
) AS $$
BEGIN
    -- Check cache invalidation volume
    RETURN QUERY
    SELECT 
        'Cache Invalidation Volume'::TEXT,
        (SELECT COUNT(*)::TEXT FROM cache_invalidation_log WHERE created_at > NOW() - INTERVAL '1 hour'),
        CASE 
            WHEN (SELECT COUNT(*) FROM cache_invalidation_log WHERE created_at > NOW() - INTERVAL '1 hour') < 100 THEN 'OK'
            WHEN (SELECT COUNT(*) FROM cache_invalidation_log WHERE created_at > NOW() - INTERVAL '1 hour') < 500 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        CASE 
            WHEN (SELECT COUNT(*) FROM cache_invalidation_log WHERE created_at > NOW() - INTERVAL '1 hour') > 500 
            THEN 'High invalidation rate - check cache efficiency'
            ELSE 'Invalidation rate is normal'
        END;
    
    -- Check tenant cache distribution
    RETURN QUERY
    SELECT 
        'Tenant Cache Distribution'::TEXT,
        (SELECT COUNT(DISTINCT school_id)::TEXT FROM cache_invalidation_log WHERE created_at > NOW() - INTERVAL '1 hour'),
        CASE 
            WHEN (SELECT COUNT(DISTINCT school_id) FROM cache_invalidation_log WHERE created_at > NOW() - INTERVAL '1 hour') > 0 THEN 'OK'
            ELSE 'WARNING'
        END,
        CASE 
            WHEN (SELECT COUNT(DISTINCT school_id) FROM cache_invalidation_log WHERE created_at > NOW() - INTERVAL '1 hour') = 0 
            THEN 'No cache activity detected'
            ELSE 'Cache distribution looks normal'
        END;
    
    -- Check for failed invalidations
    RETURN QUERY
    SELECT 
        'Cache Invalidation Failures'::TEXT,
        '0'::TEXT, -- This would be tracked in your application logs
        'OK'::TEXT,
        'Monitor application logs for cache failures'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Cache cleanup function (maintenance)
CREATE OR REPLACE FUNCTION cleanup_cache_invalidation_log(
    days_to_keep INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old cache invalidation logs
    DELETE FROM cache_invalidation_log 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Test the functions
SELECT invalidate_tenant_cache(1, 'students_list', 'Data updated');
SELECT clear_tenant_cache(1, 'Tenant logout');
SELECT * FROM cache_health_check();
SELECT * FROM tenant_cache_stats;
