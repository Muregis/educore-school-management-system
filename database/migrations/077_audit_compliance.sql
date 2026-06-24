-- Phase 13: Audit & Compliance
-- Add compliance tracking tables

-- Create data retention policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- students, teachers, payments, etc.
    retention_period_months INTEGER NOT NULL,
    archive_after_months INTEGER,
    delete_after_months INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_retention_policies_school ON data_retention_policies(school_id);
CREATE INDEX idx_retention_policies_entity ON data_retention_policies(entity_type);

-- Create compliance audit table
CREATE TABLE IF NOT EXISTS compliance_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    audit_type VARCHAR(50) NOT NULL, -- data_retention, access_log, security_review
    entity_type VARCHAR(50),
    entity_id UUID,
    action VARCHAR(50),
    result VARCHAR(20), -- compliant, non_compliant, warning
    details JSONB,
    audited_by UUID,
    audited_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compliance_audit_school ON compliance_audit(school_id);
CREATE INDEX idx_compliance_audit_type ON compliance_audit(audit_type);
CREATE INDEX idx_compliance_audit_entity ON compliance_audit(entity_type, entity_id);
CREATE INDEX idx_compliance_audit_date ON compliance_audit(audited_at);

-- Create change requests table for audit trail
CREATE TABLE IF NOT EXISTS change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    change_type VARCHAR(50) NOT NULL, -- create, update, delete, restore
    requested_by UUID NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, completed
    reason TEXT,
    old_values JSONB,
    new_values JSONB
);

CREATE INDEX idx_change_requests_school ON change_requests(school_id);
CREATE INDEX idx_change_requests_entity ON change_requests(entity_type, entity_id);
CREATE INDEX idx_change_requests_status ON change_requests(status);
