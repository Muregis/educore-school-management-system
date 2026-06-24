-- Phase 14: Backup & Disaster Recovery
-- Create backup tracking tables

-- Create backup logs table
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    backup_type VARCHAR(50) NOT NULL, -- full, incremental, differential
    backup_method VARCHAR(50) NOT NULL, -- automated, manual
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, failed
    file_path TEXT,
    file_size BIGINT,
    encrypted BOOLEAN DEFAULT TRUE,
    checksum VARCHAR(255),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_by UUID
);

CREATE INDEX idx_backup_logs_school ON backup_logs(school_id);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_date ON backup_logs(started_at);

-- Create restore logs table
CREATE TABLE IF NOT EXISTS restore_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    backup_log_id UUID REFERENCES backup_logs(id),
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, failed
    restore_point TIMESTAMPTZ,
    tables_restored TEXT[],
    rows_restored INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_by UUID
);

CREATE INDEX idx_restore_logs_school ON restore_logs(school_id);
CREATE INDEX idx_restore_logs_backup ON restore_logs(backup_log_id);
CREATE INDEX idx_restore_logs_status ON restore_logs(status);

-- Create disaster recovery plan table
CREATE TABLE IF NOT EXISTS disaster_recovery_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    plan_name VARCHAR(200) NOT NULL,
    recovery_point_objective_hours INTEGER, -- RPO in hours
    recovery_time_objective_hours INTEGER, -- RTO in hours
    backup_frequency_hours INTEGER,
    retention_days INTEGER,
    offsite_backup BOOLEAN DEFAULT FALSE,
    encryption_required BOOLEAN DEFAULT TRUE,
    contact_person VARCHAR(200),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    last_tested_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dr_plans_school ON disaster_recovery_plans(school_id);
CREATE INDEX idx_dr_plans_active ON disaster_recovery_plans(is_active);
