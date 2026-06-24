-- Phase 9: Security
-- Add security enhancements to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS password_history JSONB,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
ADD COLUMN IF NOT EXISTS session_limit INTEGER DEFAULT 5;

-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id BIGINT NOT NULL,
    token VARCHAR(500) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_school ON user_sessions(school_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Create security logs table
CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL, -- login, logout, password_change, 2fa_enabled, account_locked, etc.
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_logs_school ON security_logs(school_id);
CREATE INDEX idx_security_logs_user ON security_logs(user_id);
CREATE INDEX idx_security_logs_event ON security_logs(event_type);
CREATE INDEX idx_security_logs_created ON security_logs(created_at);
