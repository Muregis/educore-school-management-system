-- ==========================================
-- CASH-FLOW ENGINE + CBC AI - PHASE 1
-- VERIFIED NON-DESTRUCTIVE MIGRATION
-- 
-- SAFETY GUARANTEES:
-- - All CREATE statements use IF NOT EXISTS
-- - All ALTER statements use IF NOT EXISTS  
-- - No DROP TABLE statements
-- - No DROP COLUMN statements
-- - No TRUNCATE statements
-- - No DELETE statements
-- - Only foreign key ON DELETE CASCADE (for referential integrity)
-- ==========================================

-- ==========================================
-- SECTION 1: EXTEND EXISTING TABLES (Safe)
-- All columns are NULLABLE with DEFAULTS
-- No existing data will be affected
-- ==========================================

-- 1.1 Extend students table (communication preferences)
-- SAFE: New columns, nullable, with defaults
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS preferred_contact_method VARCHAR(20) DEFAULT 'sms' 
  CHECK (preferred_contact_method IN ('sms', 'whatsapp', 'email')),
ADD COLUMN IF NOT EXISTS opt_out_reminders BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_frequency VARCHAR(20) DEFAULT 'weekly'
  CHECK (reminder_frequency IN ('weekly', 'bi_weekly', 'monthly', 'none'));

COMMENT ON COLUMN students.preferred_contact_method IS 'Parent preferred communication channel';
COMMENT ON COLUMN students.opt_out_reminders IS 'If true, no automated reminders sent';
COMMENT ON COLUMN students.reminder_frequency IS 'Reminder frequency preference';

-- 1.2 Extend invoices table (payment plan linkage)
-- SAFE: Nullable foreign key columns
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_plan_id BIGINT NULL,
ADD COLUMN IF NOT EXISTS installment_number INTEGER NULL,
ADD COLUMN IF NOT EXISTS installment_of INTEGER NULL;

COMMENT ON COLUMN invoices.payment_plan_id IS 'Links to payment_plans table';

-- 1.3 Extend payments table (pledge linkage)
-- SAFE: Nullable foreign key columns  
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS pledge_id BIGINT NULL,
ADD COLUMN IF NOT EXISTS is_installment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS installment_number INTEGER NULL;

COMMENT ON COLUMN payments.pledge_id IS 'Links payment to pledge commitment';

-- 1.4 Extend schools table (feature flags)
-- SAFE: JSONB column with default empty flags
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{
  "cash_flow_engine": false,
  "payment_plans": false,
  "whatsapp_reminders": false,
  "pledges": false,
  "forecast_dashboard": false,
  "mpesa_stk": false
}'::jsonb;

COMMENT ON COLUMN schools.feature_flags IS 'Feature toggle configuration per school';

-- ==========================================
-- SECTION 2: CREATE NEW TABLES (Safe)
-- All use IF NOT EXISTS - will skip if table exists
-- No data loss possible
-- ==========================================

-- 2.1 Payment Plans (Installment schedules)
CREATE TABLE IF NOT EXISTS payment_plans (
  plan_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  invoice_id BIGINT NULL,
  plan_type VARCHAR(30) NOT NULL DEFAULT 'flexible',
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
  CONSTRAINT fk_payment_plans_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_plans_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_plans_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_school ON payment_plans(school_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_student ON payment_plans(student_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice ON payment_plans(invoice_id);

COMMENT ON TABLE payment_plans IS 'Installment payment schedules for students - CASH-FLOW ENGINE';

-- 2.2 Payment Plan Installments (Individual payment targets)
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_installments_plan FOREIGN KEY (plan_id) REFERENCES payment_plans(plan_id) ON DELETE CASCADE,
  CONSTRAINT fk_installments_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL,
  UNIQUE(plan_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_installments_plan ON payment_plan_installments(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_installments_due ON payment_plan_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_installments_payment ON payment_plan_installments(payment_id);

COMMENT ON TABLE payment_plan_installments IS 'Individual installments within a payment plan - CASH-FLOW ENGINE';

-- 2.3 Pledges (Parent payment commitments)
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
  CONSTRAINT fk_pledges_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
  CONSTRAINT fk_pledges_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_pledges_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE SET NULL,
  CONSTRAINT fk_pledges_plan FOREIGN KEY (plan_id) REFERENCES payment_plans(plan_id) ON DELETE SET NULL,
  CONSTRAINT fk_pledges_payment FOREIGN KEY (fulfillment_payment_id) REFERENCES payments(payment_id)
);

CREATE INDEX IF NOT EXISTS idx_pledges_school ON pledges(school_id, status);
CREATE INDEX IF NOT EXISTS idx_pledges_student ON pledges(student_id, promised_date);
CREATE INDEX IF NOT EXISTS idx_pledges_date ON pledges(promised_date, status);

COMMENT ON TABLE pledges IS 'Parent commitments to pay by specific dates - CASH-FLOW ENGINE';

-- 2.4 Reminder Logs (Audit trail)
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
  CONSTRAINT fk_reminders_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
  CONSTRAINT fk_reminders_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_school ON reminder_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_student ON reminder_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminder_logs(status, channel);
CREATE INDEX IF NOT EXISTS idx_reminders_effective ON reminder_logs(was_effective, message_type);
CREATE INDEX IF NOT EXISTS idx_reminders_batch ON reminder_logs(batch_id);

COMMENT ON TABLE reminder_logs IS 'Complete audit trail of all reminders sent - CASH-FLOW ENGINE';

-- 2.5 Reminder Templates (Reusable message templates)
CREATE TABLE IF NOT EXISTS reminder_templates (
  template_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NULL,
  name VARCHAR(100) NOT NULL,
  context VARCHAR(30) NOT NULL 
    CHECK (context IN ('payment_due', 'installment_reminder', 'overdue', 'thank_you', 'pledge_confirmation', 'pledge_request', 'plan_suggestion')),
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
  CONSTRAINT fk_templates_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_school ON reminder_templates(school_id, context, is_active);

COMMENT ON TABLE reminder_templates IS 'Reusable message templates for reminders - CASH-FLOW ENGINE';

-- 2.6 Forecast Snapshots (Predictive analytics)
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
  monthly_breakdown JSONB,
  confirmed_pledges_total DECIMAL(12,2) DEFAULT 0,
  pending_pledges_total DECIMAL(12,2) DEFAULT 0,
  historical_fulfillment_rate INTEGER DEFAULT 75,
  risk_students JSONB,
  at_risk_amount DECIMAL(12,2) DEFAULT 0,
  assumptions JSONB,
  generated_by VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_forecasts_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forecasts_school ON forecast_snapshots(school_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_term ON forecast_snapshots(school_id, term, academic_year);

COMMENT ON TABLE forecast_snapshots IS 'Predictive cash-flow snapshots with risk analysis - CASH-FLOW ENGINE';

-- 2.7 Pending STK Transactions (M-Pesa one-tap payments)
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
  CONSTRAINT fk_stk_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
  CONSTRAINT fk_stk_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stk_ref ON pending_stk_transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_stk_status ON pending_stk_transactions(status, initiated_at);

COMMENT ON TABLE pending_stk_transactions IS 'Pending M-Pesa STK push transactions - CASH-FLOW ENGINE';

-- 2.8 CBC Rubrics (AI-generated assessment rubrics)
CREATE TABLE IF NOT EXISTS cbc_rubrics (
  rubric_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NULL,
  subject VARCHAR(100) NOT NULL,
  grade_level VARCHAR(20) NOT NULL,
  strand VARCHAR(200) NOT NULL,
  sub_strand VARCHAR(200),
  criteria JSONB NOT NULL,
  assessment_type VARCHAR(50),
  generated_by VARCHAR(50),
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt TEXT,
  ai_raw_response TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by BIGINT,
  approved_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_rubrics_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rubrics_school ON cbc_rubrics(school_id, subject, grade_level);

COMMENT ON TABLE cbc_rubrics IS 'CBC assessment rubrics with AI generation - CBC AI';

-- 2.9 Report Comment Templates (Reusable comment templates)
CREATE TABLE IF NOT EXISTS report_comment_templates (
  template_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NULL,
  context VARCHAR(50) NOT NULL,
  subject VARCHAR(100),
  grade_level VARCHAR(20),
  tone VARCHAR(20) NOT NULL DEFAULT 'encouraging',
  template_text TEXT NOT NULL,
  variables JSONB DEFAULT '["student_name", "subject", "grade"]',
  is_ai_generated BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_comment_templates_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_templates_context ON report_comment_templates(context, subject, is_active);

COMMENT ON TABLE report_comment_templates IS 'Reusable report card comment templates - CBC AI';

-- 2.10 Generated Report Comments (AI-generated with audit)
CREATE TABLE IF NOT EXISTS generated_report_comments (
  comment_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  term VARCHAR(40) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  generated_comment TEXT NOT NULL,
  comment_sections JSONB,
  ai_model_used VARCHAR(50),
  ai_prompt TEXT,
  ai_raw_response TEXT,
  was_edited BOOLEAN DEFAULT FALSE,
  edited_by BIGINT,
  edited_comment TEXT,
  edit_reason TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by BIGINT,
  approved_at TIMESTAMPTZ,
  used_in_report_card BOOLEAN DEFAULT FALSE,
  report_card_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_comments_school FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_student ON generated_report_comments(student_id, term, academic_year);

COMMENT ON TABLE generated_report_comments IS 'AI-generated report comments with human approval - CBC AI';

-- ==========================================
-- SECTION 3: SEED DEFAULT DATA (Idempotent)
-- Only inserts if table is empty
-- ==========================================

DO $$
BEGIN
    -- Only seed if no templates exist
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
        
        RAISE NOTICE 'Default reminder templates seeded';
    ELSE
        RAISE NOTICE 'Reminder templates already exist, skipping seed';
    END IF;
END $$;

-- ==========================================
-- VERIFICATION CHECKLIST
-- ==========================================
-- ✅ All CREATE statements use IF NOT EXISTS
-- ✅ All ALTER statements use IF NOT EXISTS
-- ✅ No DROP TABLE statements
-- ✅ No DROP COLUMN statements
-- ✅ No TRUNCATE statements
-- ✅ No DELETE statements
-- ✅ All new columns are NULLABLE or have DEFAULTS
-- ✅ All existing data remains untouched
-- ✅ Safe to run multiple times (idempotent)
-- ==========================================

SELECT 'NON-DESTRUCTIVE MIGRATION COMPLETE' AS status,
       'All existing data preserved' AS message,
       'Safe to run multiple times' AS idempotent;
