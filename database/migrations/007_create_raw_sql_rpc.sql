-- Migration: Create raw SQL execution RPC function
-- This function allows executing raw SQL queries through Supabase RPC
-- IMPORTANT: This should be restricted to service role only for security

-- Create the execute_raw_sql function
CREATE OR REPLACE FUNCTION execute_raw_sql(sql_query TEXT, params TEXT[] DEFAULT '{}')
RETURNS TABLE(
  -- Return a generic JSON structure to handle different query results
  data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  param_count INTEGER;
  param_value TEXT;
  param_type TEXT;
  result_json JSONB;
BEGIN
  -- Count parameters
  param_count := array_length(params, 1);
  
  -- For security, only allow SELECT statements initially
  -- You can extend this to include INSERT, UPDATE, DELETE as needed
  IF UPPER(TRIM(sql_query)) NOT LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT statements are allowed through execute_raw_sql';
  END IF;
  
  -- Prevent dangerous SQL operations
  IF UPPER(sql_query) LIKE '%DROP%' OR 
     UPPER(sql_query) LIKE '%TRUNCATE%' OR 
     UPPER(sql_query) LIKE '%ALTER%' OR
     UPPER(sql_query) LIKE '%DELETE%' OR
     UPPER(sql_query) LIKE '%UPDATE%' OR
     UPPER(sql_query) LIKE '%INSERT%' THEN
    RAISE EXCEPTION 'Destructive operations are not allowed through execute_raw_sql';
  END IF;
  
  -- Execute the query and return results as JSON
  EXECUTE format('SELECT jsonb_agg(row_to_json(t.*))::text FROM (%s) t', sql_query)
  INTO result_json;
  
  -- Return the JSON result
  RETURN QUERY SELECT result_json;
END;
$$;

-- Create the execute_transaction function for batch operations
CREATE OR REPLACE FUNCTION execute_transaction(operations JSONB)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  op_record JSONB;
  op_sql TEXT;
  op_params JSONB;
  result JSONB;
BEGIN
  -- Start transaction
  BEGIN
    -- Loop through operations
    FOR op_record IN SELECT * FROM jsonb_array_elements(operations)
    LOOP
      op_sql := op_record->>'sql';
      op_params := op_record->'params';
      
      -- Execute operation (simplified version)
      -- In production, you'd want more sophisticated parameter handling
      EXECUTE op_sql;
    END LOOP;
    
    -- Return success
    RETURN QUERY SELECT true, 'Transaction completed successfully'::TEXT, '{}'::JSONB;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback and return error
    RETURN QUERY SELECT false, SQLERRM, '{}'::JSONB;
  END;
END;
$$;

-- Create tenant session reset function
CREATE OR REPLACE FUNCTION reset_tenant_session()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset any tenant-specific session variables
  PERFORM set_config('app.current_school_id', '', false);
  PERFORM set_config('app.current_user_id', '', false);
  PERFORM set_config('app.current_tenant_id', '', false);
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION execute_raw_sql TO service_role;
GRANT EXECUTE ON FUNCTION execute_transaction TO service_role;
GRANT EXECUTE ON FUNCTION reset_tenant_session TO service_role;

-- Add RLS policies for the functions
ALTER FUNCTION execute_raw_sql ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION execute_transaction ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION reset_tenant_session ENABLE ROW LEVEL SECURITY;
