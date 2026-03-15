-- Security Hardening Database Components
-- Database-level security enhancements for multi-tenant SaaS

-- Step 1: Create security events table for monitoring
CREATE TABLE IF NOT EXISTS security_events (
    event_id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NULL,
    user_id BIGINT NULL,
    event_type VARCHAR(50) NOT NULL, -- BOT_DETECTED, XSS_ATTEMPT, SQL_INJECTION, etc.
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    request_path VARCHAR(255) NULL,
    request_method VARCHAR(10) NULL,
    status_code INTEGER NULL,
    response_time_ms INTEGER NULL,
    payload JSONB NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_security_events_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

-- Add indexes for security monitoring
CREATE INDEX IF NOT EXISTS idx_security_events_school 
ON security_events (school_id, created_at);

CREATE INDEX IF NOT EXISTS idx_security_events_type 
ON security_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_security_events_severity 
ON security_events (severity, created_at);

CREATE INDEX IF NOT EXISTS idx_security_events_ip 
ON security_events (ip_address, created_at);

-- Step 2: Create failed login attempts table
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NULL,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    attempt_reason VARCHAR(50) NOT NULL, -- INVALID_CREDENTIALS, ACCOUNT_LOCKED, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_failed_login_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

-- Add indexes for login monitoring
CREATE INDEX IF NOT EXISTS idx_failed_login_email 
ON failed_login_attempts (email, created_at);

CREATE INDEX IF NOT EXISTS idx_failed_login_ip 
ON failed_login_attempts (ip_address, created_at);

CREATE INDEX IF NOT EXISTS idx_failed_login_school 
ON failed_login_attempts (school_id, created_at);

-- Step 3: Create security policies table
CREATE TABLE IF NOT EXISTS security_policies (
    policy_id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NULL, -- NULL means global policy
    policy_type VARCHAR(50) NOT NULL, -- PASSWORD_POLICY, MFA_POLICY, SESSION_POLICY, etc.
    policy_name VARCHAR(100) NOT NULL,
    policy_config JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uk_security_policies 
        UNIQUE (school_id, policy_type, policy_name)
);

-- Step 4: Create user security settings table
CREATE TABLE IF NOT EXISTS user_security_settings (
    setting_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    school_id BIGINT NOT NULL,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(255) NULL, -- TOTP secret
    backup_codes TEXT[] NULL, -- Array of backup codes
    last_password_change TIMESTAMPTZ NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    account_locked BOOLEAN NOT NULL DEFAULT FALSE,
    lock_until TIMESTAMPTZ NULL,
    last_login_at TIMESTAMPTZ NULL,
    last_login_ip VARCHAR(45) NULL,
    security_questions JSONB NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_user_security_user 
        FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_user_security_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id),
    CONSTRAINT uk_user_security_user 
        UNIQUE (user_id)
);

-- Step 5: Create API keys table for secure access
CREATE TABLE IF NOT EXISTS api_keys (
    key_id BIGSERIAL PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL, -- Hashed API key
    key_prefix VARCHAR(20) NOT NULL, -- First few characters for identification
    school_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    permissions JSONB NOT NULL, -- Array of allowed permissions
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ NULL,
    last_used_at TIMESTAMPTZ NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_api_keys_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id),
    CONSTRAINT fk_api_keys_user 
        FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Add indexes for API key management
CREATE INDEX IF NOT EXISTS idx_api_keys_school 
ON api_keys (school_id, is_active);

CREATE INDEX IF NOT EXISTS idx_api_keys_user 
ON api_keys (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash 
ON api_keys (key_hash);

-- Step 6: Create security audit trail
CREATE TABLE IF NOT EXISTS security_audit_trail (
    audit_id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NULL,
    user_id BIGINT NULL,
    action VARCHAR(100) NOT NULL, -- PASSWORD_CHANGE, MFA_ENABLED, API_KEY_CREATED, etc.
    resource_type VARCHAR(50) NULL,
    resource_id BIGINT NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    success BOOLEAN NOT NULL,
    failure_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_security_audit_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

-- Add indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_security_audit_school 
ON security_audit_trail (school_id, created_at);

CREATE INDEX IF NOT EXISTS idx_security_audit_user 
ON security_audit_trail (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_security_audit_action 
ON security_audit_trail (action, created_at);

-- Step 7: Enable RLS for security tables
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS policies for security events
CREATE POLICY "Users can view security events from their school only" ON security_events
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "System can insert security events" ON security_events
  FOR INSERT
  WITH CHECK (true);

-- RLS policies for failed login attempts
CREATE POLICY "Users can view failed login attempts from their school only" ON failed_login_attempts
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "System can insert failed login attempts" ON failed_login_attempts
  FOR INSERT
  WITH CHECK (true);

-- RLS policies for security policies
CREATE POLICY "Users can view security policies from their school only" ON security_policies
  FOR SELECT
  USING (school_id IS NULL OR school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Admins can manage security policies" ON security_policies
  FOR ALL
  USING (school_id IS NULL OR school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id IS NULL OR school_id = (auth.jwt() ->> 'school_id')::bigint);

-- RLS policies for user security settings
CREATE POLICY "Users can view their own security settings" ON user_security_settings
  FOR SELECT
  USING (user_id = (auth.jwt() ->> 'user_id')::bigint);

CREATE POLICY "Users can update their own security settings" ON user_security_settings
  FOR UPDATE
  USING (user_id = (auth.jwt() ->> 'user_id')::bigint)
  WITH CHECK (user_id = (auth.jwt() ->> 'user_id')::bigint);

CREATE POLICY "System can manage user security settings" ON user_security_settings
  FOR INSERT
  WITH CHECK (true);

-- RLS policies for API keys
CREATE POLICY "Users can view API keys from their school only" ON api_keys
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can manage their own API keys" ON api_keys
  FOR ALL
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint AND user_id = (auth.jwt() ->> 'user_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint AND user_id = (auth.jwt() ->> 'user_id')::bigint);

-- RLS policies for security audit trail
CREATE POLICY "Users can view security audit from their school only" ON security_audit_trail
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "System can insert security audit" ON security_audit_trail
  FOR INSERT
  WITH CHECK (true);

-- Step 8: Security monitoring functions
CREATE OR REPLACE FUNCTION log_security_event(
    p_school_id BIGINT,
    p_user_id BIGINT,
    p_event_type VARCHAR(50),
    p_severity VARCHAR(20) DEFAULT 'MEDIUM',
    p_ip_address VARCHAR(45),
    p_user_agent TEXT DEFAULT NULL,
    p_request_path VARCHAR(255) DEFAULT NULL,
    p_request_method VARCHAR(10) DEFAULT NULL,
    p_status_code INTEGER DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_payload JSONB DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_event_id BIGINT;
BEGIN
    INSERT INTO security_events (
        school_id, user_id, event_type, severity, ip_address, user_agent,
        request_path, request_method, status_code, response_time_ms, payload
    ) VALUES (
        p_school_id, p_user_id, p_event_type, p_severity, p_ip_address, p_user_agent,
        p_request_path, p_request_method, p_status_code, p_response_time_ms, p_payload
    ) RETURNING event_id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Failed login tracking function
CREATE OR REPLACE FUNCTION track_failed_login(
    p_school_id BIGINT,
    p_email VARCHAR(255),
    p_ip_address VARCHAR(45),
    p_user_agent TEXT DEFAULT NULL,
    p_attempt_reason VARCHAR(50) DEFAULT 'INVALID_CREDENTIALS'
) RETURNS BOOLEAN AS $$
DECLARE
    v_attempt_count INTEGER;
    v_user_id BIGINT;
BEGIN
    -- Log the failed attempt
    INSERT INTO failed_login_attempts (school_id, email, ip_address, user_agent, attempt_reason)
    VALUES (p_school_id, p_email, p_ip_address, p_user_agent, p_attempt_reason);
    
    -- Count recent failed attempts for this IP
    SELECT COUNT(*) INTO v_attempt_count
    FROM failed_login_attempts 
    WHERE ip_address = p_ip_address 
    AND created_at > NOW() - INTERVAL '15 minutes';
    
    -- If too many attempts, lock the account or block the IP
    IF v_attempt_count >= 10 THEN
        -- Log security event
        PERFORM log_security_event(
            p_school_id, NULL, 'BRUTE_FORCE_DETECTED', 'HIGH', p_ip_address, p_user_agent,
            NULL, NULL, NULL, NULL, json_build_object('attempt_count', v_attempt_count)
        );
        
        -- You could implement IP blocking here
        RETURN FALSE;
    END IF;
    
    -- Check if user account should be locked
    SELECT user_id INTO v_user_id
    FROM users 
    WHERE email = p_email AND school_id = p_school_id;
    
    IF v_user_id IS NOT NULL THEN
        -- Count failed attempts for this user
        SELECT COUNT(*) INTO v_attempt_count
        FROM failed_login_attempts 
        WHERE email = p_email 
        AND created_at > NOW() - INTERVAL '1 hour';
        
        IF v_attempt_count >= 5 THEN
            -- Lock user account
            UPDATE user_security_settings 
            SET account_locked = true, lock_until = NOW() + INTERVAL '30 minutes'
            WHERE user_id = v_user_id;
            
            -- Log security event
            PERFORM log_security_event(
                p_school_id, v_user_id, 'ACCOUNT_LOCKED', 'HIGH', p_ip_address, p_user_agent,
                NULL, NULL, NULL, NULL, json_build_object('attempt_count', v_attempt_count)
            );
            
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Security metrics function
CREATE OR REPLACE FUNCTION get_security_metrics(
    p_school_id BIGINT DEFAULT NULL,
    p_hours_back INTEGER DEFAULT 24
) RETURNS TABLE(
    metric_name TEXT,
    metric_value BIGINT,
    severity_level TEXT
) AS $$
BEGIN
    -- Security events by severity
    RETURN QUERY
    SELECT 
        'Security Events - High Severity'::TEXT,
        COUNT(*)::BIGINT,
        'HIGH'::TEXT
    FROM security_events 
    WHERE (p_school_id IS NULL OR school_id = p_school_id)
    AND severity = 'HIGH'
    AND created_at > NOW() - INTERVAL '1 hour' * p_hours_back;
    
    RETURN QUERY
    SELECT 
        'Security Events - Critical Severity'::TEXT,
        COUNT(*)::BIGINT,
        'CRITICAL'::TEXT
    FROM security_events 
    WHERE (p_school_id IS NULL OR school_id = p_school_id)
    AND severity = 'CRITICAL'
    AND created_at > NOW() - INTERVAL '1 hour' * p_hours_back;
    
    -- Failed login attempts
    RETURN QUERY
    SELECT 
        'Failed Login Attempts'::TEXT,
        COUNT(*)::BIGINT,
        CASE 
            WHEN COUNT(*) > 100 THEN 'HIGH'
            WHEN COUNT(*) > 50 THEN 'MEDIUM'
            ELSE 'LOW'
        END
    FROM failed_login_attempts 
    WHERE (p_school_id IS NULL OR school_id = p_school_id)
    AND created_at > NOW() - INTERVAL '1 hour' * p_hours_back;
    
    -- Bot detection events
    RETURN QUERY
    SELECT 
        'Bot Detection Events'::TEXT,
        COUNT(*)::BIGINT,
        CASE 
            WHEN COUNT(*) > 50 THEN 'HIGH'
            WHEN COUNT(*) > 20 THEN 'MEDIUM'
            ELSE 'LOW'
        END
    FROM security_events 
    WHERE (p_school_id IS NULL OR school_id = p_school_id)
    AND event_type = 'BOT_DETECTED'
    AND created_at > NOW() - INTERVAL '1 hour' * p_hours_back;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Initialize default security policies
INSERT INTO security_policies (school_id, policy_type, policy_name, policy_config) VALUES
(NULL, 'PASSWORD_POLICY', 'Default Password Policy', json_build_object(
    'min_length', 8,
    'require_uppercase', true,
    'require_lowercase', true,
    'require_numbers', true,
    'require_symbols', true,
    'max_age_days', 90,
    'prevent_reuse', 5
)),
(NULL, 'MFA_POLICY', 'Default MFA Policy', json_build_object(
    'required_for_admins', true,
    'required_for_financial', true,
    'backup_codes_count', 10
)),
(NULL, 'SESSION_POLICY', 'Default Session Policy', json_build_object(
    'max_session_hours', 8,
    'require_reauth_for_sensitive', true,
    'concurrent_sessions', 3
))
ON CONFLICT (school_id, policy_type, policy_name) DO NOTHING;

-- Step 12: Test the functions
SELECT log_security_event(1, 1, 'TEST_EVENT', 'LOW', '127.0.0.1', 'Test-Agent', '/api/test', 'GET', 200, 100);
SELECT track_failed_login(1, 'test@example.com', '127.0.0.1', 'Test-Agent', 'INVALID_CREDENTIALS');
SELECT * FROM get_security_metrics(1, 24);
