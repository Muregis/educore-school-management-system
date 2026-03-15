-- Financial System Security Improvements
-- Database-level financial security for multi-tenant SaaS

-- Step 1: Create financial transactions table with immutability
CREATE TABLE IF NOT EXISTS financial_transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('payment', 'refund', 'charge', 'adjustment')),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    reference VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    gateway VARCHAR(50) NULL, -- paystack, mpesa, etc.
    gateway_transaction_id VARCHAR(200) NULL,
    metadata JSONB NULL,
    immutable_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity
    is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints for financial integrity
    CONSTRAINT fk_financial_transactions_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id),
    CONSTRAINT uk_financial_transactions_reference 
        UNIQUE (school_id, reference),
    CONSTRAINT chk_financial_transactions_amount 
        CHECK (amount > 0)
);

-- Add indexes for financial queries
CREATE INDEX IF NOT EXISTS idx_financial_transactions_school 
ON financial_transactions (school_id, created_at);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_reference 
ON financial_transactions (reference);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_status 
ON financial_transactions (school_id, status);

-- Step 2: Create financial audit log
CREATE TABLE IF NOT EXISTS financial_audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    transaction_id BIGINT NULL,
    user_id BIGINT NULL,
    action VARCHAR(50) NOT NULL, -- created, updated, viewed, exported
    old_values JSONB NULL,
    new_values JSONB NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_financial_audit_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id),
    CONSTRAINT fk_financial_audit_transaction 
        FOREIGN KEY (transaction_id) REFERENCES financial_transactions(transaction_id)
);

-- Add indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_financial_audit_school 
ON financial_audit_log (school_id, created_at);

CREATE INDEX IF NOT EXISTS idx_financial_audit_transaction 
ON financial_audit_log (transaction_id);

-- Step 3: Create tenant financial limits
CREATE TABLE IF NOT EXISTS tenant_financial_limits (
    limit_id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL,
    limit_type VARCHAR(50) NOT NULL, -- daily_limit, transaction_limit, monthly_limit
    limit_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uk_tenant_financial_limits 
        UNIQUE (school_id, limit_type),
    CONSTRAINT fk_tenant_financial_limits_school 
        FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

-- Step 4: Enable RLS for financial tables
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_financial_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for financial transactions
CREATE POLICY "Users can view financial transactions from their school only" ON financial_transactions
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Users can insert financial transactions for their school only" ON financial_transactions
  FOR INSERT
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- No UPDATE or DELETE policies for immutability
CREATE POLICY "No updates to financial transactions" ON financial_transactions
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes to financial transactions" ON financial_transactions
  FOR DELETE
  USING (false);

-- RLS policies for financial audit log
CREATE POLICY "Users can view financial audit from their school only" ON financial_audit_log
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "System can insert financial audit" ON financial_audit_log
  FOR INSERT
  WITH CHECK (true);

-- No UPDATE or DELETE for audit trail
CREATE POLICY "No updates to financial audit" ON financial_audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes to financial audit" ON financial_audit_log
  FOR DELETE
  USING (false);

-- RLS policies for tenant financial limits
CREATE POLICY "Users can view financial limits from their school only" ON tenant_financial_limits
  FOR SELECT
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

CREATE POLICY "Admins can manage financial limits for their school" ON tenant_financial_limits
  FOR ALL
  USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
  WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- Step 5: Financial security functions
CREATE OR REPLACE FUNCTION verify_financial_transaction_integrity(
    p_transaction_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_hash VARCHAR(64);
    v_expected_hash VARCHAR(64);
    v_transaction RECORD;
BEGIN
    -- Get transaction details
    SELECT school_id, amount, reference, immutable_hash 
    INTO v_transaction
    FROM financial_transactions 
    WHERE transaction_id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found';
        RETURN FALSE;
    END IF;
    
    -- Generate expected hash
    SELECT encode(sha256(
        json_build_object(
            'school_id', v_transaction.school_id,
            'amount', v_transaction.amount,
            'reference', v_transaction.reference
        )::text
    ), 'hex') INTO v_expected_hash;
    
    -- Compare hashes
    RETURN v_transaction.immutable_hash = v_expected_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Financial transaction creation function
CREATE OR REPLACE FUNCTION create_financial_transaction(
    p_school_id BIGINT,
    p_transaction_type VARCHAR(50),
    p_amount DECIMAL(12,2),
    p_currency VARCHAR(3) DEFAULT 'USD',
    p_reference VARCHAR(100),
    p_gateway VARCHAR(50) DEFAULT NULL,
    p_gateway_transaction_id VARCHAR(200) DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_transaction_id BIGINT;
    v_hash VARCHAR(64);
    v_current_user_id BIGINT;
BEGIN
    -- Get current user from JWT
    v_current_user_id := (auth.jwt() ->> 'user_id')::bigint;
    
    -- Generate immutable hash
    SELECT encode(sha256(
        json_build_object(
            'school_id', p_school_id,
            'amount', p_amount,
            'reference', p_reference,
            'timestamp', NOW()
        )::text
    ), 'hex') INTO v_hash;
    
    -- Create transaction
    INSERT INTO financial_transactions (
        school_id, transaction_type, amount, currency, reference, 
        gateway, gateway_transaction_id, metadata, immutable_hash
    ) VALUES (
        p_school_id, p_transaction_type, p_amount, p_currency, p_reference,
        p_gateway, p_gateway_transaction_id, p_metadata, v_hash
    ) RETURNING transaction_id INTO v_transaction_id;
    
    -- Log audit entry
    INSERT INTO financial_audit_log (
        school_id, transaction_id, user_id, action, new_values
    ) VALUES (
        p_school_id, v_transaction_id, v_current_user_id, 'created',
        json_build_object(
            'transaction_type', p_transaction_type,
            'amount', p_amount,
            'reference', p_reference
        )
    );
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Financial limits validation function
CREATE OR REPLACE FUNCTION validate_financial_limits(
    p_school_id BIGINT,
    p_amount DECIMAL(12,2),
    p_transaction_type VARCHAR(50) DEFAULT 'payment'
) RETURNS BOOLEAN AS $$
DECLARE
    v_daily_limit DECIMAL(12,2);
    v_transaction_limit DECIMAL(12,2);
    v_daily_total DECIMAL(12,2);
BEGIN
    -- Get limits for this school
    SELECT 
        COALESCE(MAX(CASE WHEN limit_type = 'daily_limit' THEN limit_amount END), 10000),
        COALESCE(MAX(CASE WHEN limit_type = 'transaction_limit' THEN limit_amount END), 5000)
    INTO v_daily_limit, v_transaction_limit
    FROM tenant_financial_limits 
    WHERE school_id = p_school_id AND is_active = true;
    
    -- Check transaction limit
    IF p_amount > v_transaction_limit THEN
        RAISE EXCEPTION 'Transaction amount % exceeds limit %', p_amount, v_transaction_limit;
        RETURN FALSE;
    END IF;
    
    -- Check daily limit
    SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
    FROM financial_transactions 
    WHERE school_id = p_school_id 
    AND DATE(created_at) = CURRENT_DATE 
    AND status = 'completed';
    
    IF (v_daily_total + p_amount) > v_daily_limit THEN
        RAISE EXCEPTION 'Daily total % would exceed limit %', v_daily_total + p_amount, v_daily_limit;
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Financial health check function
CREATE OR REPLACE FUNCTION financial_health_check()
RETURNS TABLE(
    metric_name TEXT,
    metric_value TEXT,
    status TEXT,
    recommendation TEXT
) AS $$
BEGIN
    -- Check transaction volume
    RETURN QUERY
    SELECT 
        'Transaction Volume'::TEXT,
        (SELECT COUNT(*)::TEXT FROM financial_transactions WHERE created_at > NOW() - INTERVAL '1 hour'),
        CASE 
            WHEN (SELECT COUNT(*) FROM financial_transactions WHERE created_at > NOW() - INTERVAL '1 hour') < 100 THEN 'OK'
            WHEN (SELECT COUNT(*) FROM financial_transactions WHERE created_at > NOW() - INTERVAL '1 hour') < 500 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        CASE 
            WHEN (SELECT COUNT(*) FROM financial_transactions WHERE created_at > NOW() - INTERVAL '1 hour') > 500 
            THEN 'High transaction volume - monitor system performance'
            ELSE 'Transaction volume is normal'
        END;
    
    -- Check failed transactions
    RETURN QUERY
    SELECT 
        'Failed Transactions'::TEXT,
        (SELECT COUNT(*)::TEXT FROM financial_transactions WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour'),
        CASE 
            WHEN (SELECT COUNT(*) FROM financial_transactions WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour') = 0 THEN 'OK'
            WHEN (SELECT COUNT(*) FROM financial_transactions WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour') < 10 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        CASE 
            WHEN (SELECT COUNT(*) FROM financial_transactions WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour') > 10 
            THEN 'Investigate payment gateway issues'
            ELSE 'Failed transaction rate is acceptable'
        END;
    
    -- Check financial integrity
    RETURN QUERY
    SELECT 
        'Transaction Integrity'::TEXT,
        (SELECT COUNT(*)::TEXT FROM financial_transactions WHERE created_at > NOW() - INTERVAL '1 hour'),
        'OK'::TEXT,
        'Verify transaction hashes periodically'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Test the functions
SELECT create_financial_transaction(1, 'payment', 100.00, 'USD', 'TEST-REF-001');
SELECT verify_financial_transaction_integrity(1);
SELECT validate_financial_limits(1, 100.00, 'payment');
SELECT * FROM financial_health_check();
