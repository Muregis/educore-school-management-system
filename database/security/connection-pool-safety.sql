-- Connection Pool Safety Improvements for Multi-Tenant SaaS
-- Apply these configurations to enhance connection pool security

-- Step 1: Enhanced session reset function
CREATE OR REPLACE FUNCTION reset_tenant_session()
RETURNS void AS $$
BEGIN
    -- Reset all tenant-specific session variables
    PERFORM set_config('app.current_school_id', NULL, false);
    PERFORM set_config('app.current_user_id', NULL, false);
    PERFORM set_config('app.current_role', NULL, false);
    PERFORM set_config('app.current_tenant_context', NULL, false);
    
    -- Reset search_path to prevent schema contamination
    PERFORM set_config('search_path', 'public', false);
    
    -- Reset any application-specific settings
    PERFORM set_config('app.request_id', NULL, false);
    PERFORM set_config('app.session_start', NULL, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Add connection pool monitoring view
CREATE OR REPLACE VIEW connection_pool_stats AS
SELECT 
    'connection_pool' as metric_type,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') as idle_in_transaction,
    (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections,
    (SELECT setting FROM pg_settings WHERE name = 'shared_buffers') as shared_buffers,
    NOW() as check_time;

-- Step 3: Tenant context validation function
CREATE OR REPLACE FUNCTION validate_tenant_context(expected_school_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if current session has correct tenant context
    IF current_setting('app.current_school_id', true)::BIGINT != expected_school_id THEN
        RAISE EXCEPTION 'Tenant context mismatch: expected %, got %', 
                        expected_school_id, 
                        current_setting('app.current_school_id', true);
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Connection pool health check
CREATE OR REPLACE FUNCTION connection_pool_health_check()
RETURNS TABLE(
    metric_name TEXT,
    current_value TEXT,
    status TEXT,
    recommendation TEXT
) AS $$
BEGIN
    -- Check active connections
    RETURN QUERY
    SELECT 
        'Active Connections'::TEXT,
        (SELECT count(*)::TEXT FROM pg_stat_activity WHERE state = 'active'),
        CASE 
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') < 50 THEN 'OK'
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') < 80 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        CASE 
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') > 80 
            THEN 'Consider increasing pool size'
            ELSE 'Connection load is acceptable'
        END;
    
    -- Check idle connections
    RETURN QUERY
    SELECT 
        'Idle Connections'::TEXT,
        (SELECT count(*)::TEXT FROM pg_stat_activity WHERE state = 'idle'),
        CASE 
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') > 20 THEN 'WARNING'
            ELSE 'OK'
        END,
        CASE 
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') > 20 
            THEN 'Consider reducing idle timeout'
            ELSE 'Idle connection count is acceptable'
        END;
    
    -- Check for long-running transactions
    RETURN QUERY
    SELECT 
        'Long Running Transactions'::TEXT,
        (SELECT count(*)::TEXT FROM pg_stat_activity WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '5 minutes'),
        CASE 
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '5 minutes') = 0 THEN 'OK'
            ELSE 'CRITICAL'
        END,
        CASE 
            WHEN (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '5 minutes') > 0 
            THEN 'Investigate and terminate long-running transactions'
            ELSE 'No long-running transactions detected'
        END;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Test the functions
SELECT reset_tenant_session();

SELECT * FROM connection_pool_stats;

SELECT * FROM connection_pool_health_check();
