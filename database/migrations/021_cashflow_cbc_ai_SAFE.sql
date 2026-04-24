-- ==========================================
-- CASH-FLOW PHASE 1: PRODUCTION-SAFE MIGRATION
-- WARNING: This version NEVER drops existing tables
-- Run this if 021_cashflow_cbc_ai.sql partially ran or tables exist
-- ==========================================

-- 1. FIX CONSTRAINT ISSUE (if table exists)
-- ==========================================
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reminder_templates') THEN
        -- Check if constraint exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'reminder_templates' 
            AND constraint_name = 'reminder_templates_context_check'
        ) THEN
            -- Safe: Only drop constraint, not table (no data loss)
            ALTER TABLE reminder_templates DROP CONSTRAINT reminder_templates_context_check;
            
            -- Add corrected constraint
            ALTER TABLE reminder_templates ADD CONSTRAINT reminder_templates_context_check 
                CHECK (context IN ('payment_due', 'installment_reminder', 'overdue', 'thank_you', 'pledge_confirmation', 'pledge_request', 'plan_suggestion'));
            
            RAISE NOTICE 'Fixed reminder_templates constraint';
        END IF;
    END IF;
END $$;

-- 2. CREATE MISSING TABLES ONLY (NEVER drop existing)
-- ==========================================

-- Payment Plans
CREATE TABLE IF NOT EXISTS payment_plans (
  plan_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  invoice_id BIGINT NULL,
  plan_type VARCHAR(30) NOT NULL DEFAULT 'flexible',
  frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  installment_count INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_payment_plans_school FOREIGN KEY (school_id) REFERENCES schools(school_id),
  CONSTRAINT fk_payment_plans_student FOREIGN KEY (student_id) REFERENCES students(student_id),
  CONSTRAINT fk_payment_plans_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
);

-- Installments
CREATE TABLE IF NOT EXISTS payment_plan_installments (
  installment_id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  target_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_id BIGINT NULL,
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_installments_plan FOREIGN KEY (plan_id) REFERENCES payment_plans(plan_id) ON DELETE CASCADE,
  CONSTRAINT fk_installments_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id),
  UNIQUE(plan_id, installment_number)
);

-- Pledges
CREATE TABLE IF NOT EXISTS pledges (
  pledge_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  invoice_id BIGINT NULL,
  plan_id BIGINT NULL,
  amount DECIMAL(12,2) NOT NULL,
  promised_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  source VARCHAR(30) NOT NULL DEFAULT 'parent_portal',
  recorded_by BIGINT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  fulfillment_payment_id BIGINT NULL,
  fulfillment_date DATE,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_pledges_school FOREIGN KEY (school_id) REFERENCES schools(school_id),
  CONSTRAINT fk_pledges_student FOREIGN KEY (student_id) REFERENCES students(student_id),
  CONSTRAINT fk_pledges_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
  CONSTRAINT fk_pledges_plan FOREIGN KEY (plan_id) REFERENCES payment_plans(plan_id),
  CONSTRAINT fk_pledges_payment FOREIGN KEY (fulfillment_payment_id) REFERENCES payments(payment_id)
);

-- Reminder Logs
CREATE TABLE IF NOT EXISTS reminder_logs (
  log_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  invoice_id BIGINT NULL,
  pledge_id BIGINT NULL,
  installment_id BIGINT NULL,
  channel VARCHAR(20) NOT NULL,
  message_type VARCHAR(30) NOT NULL,
  content TEXT NOT NULL,
  template_used VARCHAR(100),
  variables_replaced JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  reply_content TEXT,
  reply_received_at TIMESTAMPTZ,
  was_effective BOOLEAN,
  escalation_level VARCHAR(20) DEFAULT 'none',
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by BIGINT,
  approved_at TIMESTAMPTZ,
  batch_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_reminders_school FOREIGN KEY (school_id) REFERENCES schools(school_id),
  CONSTRAINT fk_reminders_student FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- Reminder Templates (will use fixed constraint from above)
CREATE TABLE IF NOT EXISTS reminder_templates (
  template_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NULL,
  name VARCHAR(100) NOT NULL,
  context VARCHAR(30) NOT NULL,
  tone VARCHAR(20) NOT NULL DEFAULT 'neutral',
  channel VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  effectiveness_score DECIMAL(5,2),
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_templates_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

-- Forecast Snapshots
CREATE TABLE IF NOT EXISTS forecast_snapshots (
  snapshot_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  term VARCHAR(40) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  total_expected DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  projected_collection DECIMAL(12,2) NOT NULL DEFAULT 0,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  weekly_breakdown JSONB,
  confirmed_pledges_total DECIMAL(12,2) DEFAULT 0,
  pending_pledges_total DECIMAL(12,2) DEFAULT 0,
  historical_fulfillment_rate INTEGER DEFAULT 75,
  risk_students JSONB,
  at_risk_amount DECIMAL(12,2) DEFAULT 0,
  assumptions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_forecasts_school FOREIGN KEY (school_id) REFERENCES schools(school_id)
);

-- Pending STK Transactions
CREATE TABLE IF NOT EXISTS pending_stk_transactions (
  stk_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  invoice_id BIGINT NULL,
  plan_id BIGINT NULL,
  installment_id BIGINT NULL,
  reference_number VARCHAR(100) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result_code VARCHAR(10),
  result_desc TEXT,
  mpesa_receipt_number VARCHAR(100),
  mpesa_transaction_date TIMESTAMPTZ,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  callback_received_at TIMESTAMPTZ,
  callback_payload JSONB,
  CONSTRAINT fk_stk_school FOREIGN KEY (school_id) REFERENCES schools(school_id),
  CONSTRAINT fk_stk_student FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- 3. SAFE COLUMN ADDITIONS (only if columns don't exist)
-- ==========================================

DO $$
BEGIN
    -- Students table extensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'preferred_contact_method') THEN
        ALTER TABLE students ADD COLUMN preferred_contact_method VARCHAR(20) DEFAULT 'sms';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'opt_out_reminders') THEN
        ALTER TABLE students ADD COLUMN opt_out_reminders BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'reminder_frequency') THEN
        ALTER TABLE students ADD COLUMN reminder_frequency VARCHAR(20) DEFAULT 'weekly';
    END IF;

    -- Invoices extensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'payment_plan_id') THEN
        ALTER TABLE invoices ADD COLUMN payment_plan_id BIGINT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'installment_number') THEN
        ALTER TABLE invoices ADD COLUMN installment_number INTEGER NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'installment_of') THEN
        ALTER TABLE invoices ADD COLUMN installment_of INTEGER NULL;
    END IF;

    -- Payments extensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'pledge_id') THEN
        ALTER TABLE payments ADD COLUMN pledge_id BIGINT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'is_installment') THEN
        ALTER TABLE payments ADD COLUMN is_installment BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'installment_number') THEN
        ALTER TABLE payments ADD COLUMN installment_number INTEGER NULL;
    END IF;

    -- Schools feature flags
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'feature_flags') THEN
        ALTER TABLE schools ADD COLUMN feature_flags JSONB DEFAULT '{"cash_flow_engine": false, "payment_plans": false, "whatsapp_reminders": false, "pledges": false, "forecast_dashboard": false, "mpesa_stk": false}'::jsonb;
    END IF;
    
    RAISE NOTICE 'All column additions completed safely';
END $$;

-- 4. CREATE INDEXES (safe to re-run)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_payment_plans_school ON payment_plans(school_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_student ON payment_plans(student_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice ON payment_plans(invoice_id);

CREATE INDEX IF NOT EXISTS idx_installments_plan ON payment_plan_installments(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_installments_due ON payment_plan_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_installments_payment ON payment_plan_installments(payment_id);

CREATE INDEX IF NOT EXISTS idx_pledges_school ON pledges(school_id, status);
CREATE INDEX IF NOT EXISTS idx_pledges_student ON pledges(student_id, promised_date);
CREATE INDEX IF NOT EXISTS idx_pledges_date ON pledges(promised_date, status);

CREATE INDEX IF NOT EXISTS idx_reminders_school ON reminder_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_student ON reminder_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminder_logs(status, channel);
CREATE INDEX IF NOT EXISTS idx_reminders_effective ON reminder_logs(was_effective, message_type);
CREATE INDEX IF NOT EXISTS idx_reminders_batch ON reminder_logs(batch_id);

CREATE INDEX IF NOT EXISTS idx_templates_school ON reminder_templates(school_id, context, is_active);

CREATE INDEX IF NOT EXISTS idx_forecasts_school ON forecast_snapshots(school_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_term ON forecast_snapshots(school_id, term, academic_year);

CREATE INDEX IF NOT EXISTS idx_stk_ref ON pending_stk_transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_stk_status ON pending_stk_transactions(status, initiated_at);

-- 5. SEED TEMPLATES (only if table is empty or specific templates missing)
-- ==========================================

DO $$
BEGIN
    -- Only insert if templates table is empty
    IF NOT EXISTS (SELECT 1 FROM reminder_templates LIMIT 1) THEN
        INSERT INTO reminder_templates (name, context, tone, channel, content, variables) VALUES
        ('Gentle Reminder - WhatsApp', 'payment_due', 'encouraging', 'whatsapp', 
         'Hello {{parent_name}}, this is a friendly reminder that school fees for {{student_name}} are due. Current balance: KES {{balance}}. Due date: {{due_date}}. Pay easily here: {{pay_link}} Thank you!', 
         '["parent_name", "student_name", "balance", "due_date", "pay_link"]'),

        ('Firm Reminder - WhatsApp', 'overdue', 'firm', 'whatsapp', 
         'Dear {{parent_name}}, {{student_name}}''s school fees of KES {{balance}} are now overdue (due {{due_date}}). Please make payment within 48 hours to avoid any inconvenience. Pay here: {{pay_link}}', 
         '["parent_name", "student_name", "balance", "due_date", "pay_link"]'),

        ('Thank You - WhatsApp', 'thank_you', 'encouraging', 'whatsapp', 
         'Thank you {{parent_name}} for your payment of KES {{amount}} for {{student_name}}. Your support makes a difference! Updated balance: KES {{balance}}.', 
         '["parent_name", "amount", "student_name", "balance"]'),

        ('Installment Reminder', 'installment_reminder', 'neutral', 'whatsapp', 
         'Hi {{parent_name}}, this is a reminder that installment {{installment_number}} of {{total_installments}} for {{student_name}} is due on {{due_date}}. Amount: KES {{amount}}. Pay: {{pay_link}}', 
         '["parent_name", "installment_number", "total_installments", "student_name", "due_date", "amount", "pay_link"]'),

        ('Pledge Confirmation', 'pledge_confirmation', 'encouraging', 'whatsapp', 
         'Thank you {{parent_name}} for committing to pay KES {{amount}} by {{promised_date}} for {{student_name}}. We appreciate your partnership! You''ll receive a reminder 2 days before.', 
         '["parent_name", "amount", "promised_date", "student_name"]');
        
        RAISE NOTICE 'Seed templates inserted';
    ELSE
        RAISE NOTICE 'Templates already exist, skipping seed';
    END IF;
END $$;

-- ==========================================
-- MIGRATION COMPLETE - NO DATA LOST
-- ==========================================
SELECT 'Cash-Flow Phase 1 SAFE migration complete - all existing data preserved' AS status;
