-- ==========================================
-- EduCore Cash-Flow Engine + CBC AI
-- Safe Schema Additions (Non-Destructive)
-- ==========================================

-- B1. Extend students (communication preferences)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS preferred_contact_method VARCHAR(20) DEFAULT 'sms' 
  CHECK (preferred_contact_method IN ('sms', 'whatsapp', 'email')),
ADD COLUMN IF NOT EXISTS opt_out_reminders BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_frequency VARCHAR(20) DEFAULT 'weekly'
  CHECK (reminder_frequency IN ('weekly', 'bi_weekly', 'monthly', 'none'));

-- B2. Extend invoices (payment plan linkage)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_plan_id BIGINT NULL,
ADD COLUMN IF NOT EXISTS installment_number INTEGER NULL,
ADD COLUMN IF NOT EXISTS installment_of INTEGER NULL;

-- B3. Extend payments (pledge linkage)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS pledge_id BIGINT NULL,
ADD COLUMN IF NOT EXISTS is_installment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS installment_number INTEGER NULL;

-- B4. Payment Plans (NEW TABLE)
CREATE TABLE IF NOT EXISTS payment_plans (
  plan_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES invoices(invoice_id) ON DELETE SET NULL,
  plan_type VARCHAR(30) NOT NULL DEFAULT 'flexible' 
    CHECK (plan_type IN ('flexible', 'fixed_date', 'pledge_based')),
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  installment_count INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'completed', 'cancelled', 'defaulted')),
  notes TEXT,
  created_by BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_school ON payment_plans(school_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_student ON payment_plans(student_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice ON payment_plans(invoice_id);

-- B5. Payment Plan Installments (NEW TABLE)
CREATE TABLE IF NOT EXISTS payment_plan_installments (
  installment_id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES payment_plans(plan_id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  target_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'paid', 'overdue', 'waived', 'renegotiated')),
  payment_id BIGINT REFERENCES payments(payment_id) ON DELETE SET NULL,
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_installments_plan ON payment_plan_installments(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_installments_due ON payment_plan_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_installments_payment ON payment_plan_installments(payment_id);

-- B6. Pledges (Parent Commitments) (NEW TABLE)
CREATE TABLE IF NOT EXISTS pledges (
  pledge_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES invoices(invoice_id) ON DELETE SET NULL,
  plan_id BIGINT REFERENCES payment_plans(plan_id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  promised_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'fulfilled', 'broken', 'expired', 'renegotiated')),
  source VARCHAR(30) NOT NULL DEFAULT 'parent_portal' 
    CHECK (source IN ('parent_portal', 'admin_recorded', 'sms_reply', 'whatsapp_reply', 'phone_call')),
  recorded_by BIGINT REFERENCES users(user_id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  fulfillment_payment_id BIGINT REFERENCES payments(payment_id),
  fulfillment_date DATE,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pledges_school ON pledges(school_id, status);
CREATE INDEX IF NOT EXISTS idx_pledges_student ON pledges(student_id, promised_date);
CREATE INDEX IF NOT EXISTS idx_pledges_date ON pledges(promised_date, status);

-- B7. Reminder Logs (NEW TABLE)
CREATE TABLE IF NOT EXISTS reminder_logs (
  log_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES invoices(invoice_id),
  pledge_id BIGINT REFERENCES pledges(pledge_id),
  installment_id BIGINT REFERENCES payment_plan_installments(installment_id),
  channel VARCHAR(20) NOT NULL 
    CHECK (channel IN ('whatsapp', 'sms', 'email', 'app_notification')),
  message_type VARCHAR(30) NOT NULL 
    CHECK (message_type IN ('reminder', 'follow_up', 'thank_you', 'escalation', 'plan_suggestion', 'pledge_confirmation')),
  content TEXT NOT NULL,
  template_used VARCHAR(100),
  variables_replaced JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'sent' 
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'replied')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  reply_content TEXT,
  reply_received_at TIMESTAMPTZ,
  was_effective BOOLEAN,
  escalation_level VARCHAR(20) DEFAULT 'none' 
    CHECK (escalation_level IN ('none', 'gentle', 'firm', 'urgent', 'admin_intervention')),
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by BIGINT REFERENCES users(user_id),
  approved_at TIMESTAMPTZ,
  batch_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_school ON reminder_logs(school_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_student ON reminder_logs(student_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminder_logs(status, channel);
CREATE INDEX IF NOT EXISTS idx_reminders_batch ON reminder_logs(batch_id);

-- B8. Reminder Templates (NEW TABLE)
CREATE TABLE IF NOT EXISTS reminder_templates (
  template_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  context VARCHAR(30) NOT NULL 
    CHECK (context IN ('payment_due', 'installment_reminder', 'overdue', 'thank_you', 'pledge_confirmation', 'pledge_request', 'plan_suggestion')),
  tone VARCHAR(20) NOT NULL DEFAULT 'neutral' 
    CHECK (tone IN ('encouraging', 'neutral', 'firm', 'urgent')),
  channel VARCHAR(20) NOT NULL 
    CHECK (channel IN ('whatsapp', 'sms', 'email')),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  effectiveness_score DECIMAL(5,2),
  created_by BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_school ON reminder_templates(school_id, context, is_active);

-- B9. Forecast Snapshots (NEW TABLE)
CREATE TABLE IF NOT EXISTS forecast_snapshots (
  snapshot_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  term VARCHAR(40) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  total_expected DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  projected_collection DECIMAL(12,2) NOT NULL DEFAULT 0,
  confidence_score DECIMAL(5,2),
  weekly_breakdown JSONB,
  monthly_breakdown JSONB,
  confirmed_pledges_total DECIMAL(12,2) DEFAULT 0,
  pending_pledges_total DECIMAL(12,2) DEFAULT 0,
  historical_fulfillment_rate DECIMAL(5,2),
  risk_students JSONB,
  at_risk_amount DECIMAL(12,2) DEFAULT 0,
  assumptions JSONB,
  generated_by VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecasts_school ON forecast_snapshots(school_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_term ON forecast_snapshots(school_id, term, academic_year);

-- B10. Pending STK Transactions (NEW TABLE)
CREATE TABLE IF NOT EXISTS pending_stk_transactions (
  stk_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES invoices(invoice_id),
  plan_id BIGINT REFERENCES payment_plans(plan_id),
  installment_id BIGINT REFERENCES payment_plan_installments(installment_id),
  reference_number VARCHAR(100) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  result_code VARCHAR(10),
  result_desc TEXT,
  mpesa_receipt_number VARCHAR(100),
  mpesa_transaction_date TIMESTAMPTZ,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  callback_received_at TIMESTAMPTZ,
  callback_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_stk_ref ON pending_stk_transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_stk_status ON pending_stk_transactions(status, initiated_at);

-- B11. CBC Rubrics (NEW TABLE)
CREATE TABLE IF NOT EXISTS cbc_rubrics (
  rubric_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id) ON DELETE CASCADE,
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
  approved_by BIGINT REFERENCES users(user_id),
  approved_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rubrics_school ON cbc_rubrics(school_id, subject, grade_level);

-- B12. Report Comment Templates (NEW TABLE)
CREATE TABLE IF NOT EXISTS report_comment_templates (
  template_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES schools(school_id) ON DELETE CASCADE,
  context VARCHAR(50) NOT NULL 
    CHECK (context IN ('performance_high', 'performance_average', 'performance_low', 
                       'improvement_shown', 'improvement_needed', 'conduct_excellent', 
                       'conduct_concern', 'attendance_good', 'attendance_poor',
                       'strength_subject', 'needs_support_subject', 'general')),
  subject VARCHAR(100),
  grade_level VARCHAR(20),
  tone VARCHAR(20) NOT NULL DEFAULT 'encouraging' 
    CHECK (tone IN ('encouraging', 'constructive', 'neutral', 'formal')),
  template_text TEXT NOT NULL,
  variables JSONB DEFAULT '["student_name", "subject", "grade"]',
  is_ai_generated BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_by BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_context ON report_comment_templates(context, subject, is_active);

-- B13. Generated Report Comments (NEW TABLE)
CREATE TABLE IF NOT EXISTS generated_report_comments (
  comment_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  term VARCHAR(40) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  generated_comment TEXT NOT NULL,
  comment_sections JSONB,
  ai_model_used VARCHAR(50),
  ai_prompt TEXT,
  ai_raw_response TEXT,
  was_edited BOOLEAN DEFAULT FALSE,
  edited_by BIGINT REFERENCES users(user_id),
  edited_comment TEXT,
  edit_reason TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by BIGINT REFERENCES users(user_id),
  approved_at TIMESTAMPTZ,
  used_in_report_card BOOLEAN DEFAULT FALSE,
  report_card_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_student ON generated_report_comments(student_id, term, academic_year);

-- B14. Extend schools (feature flags)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{
  "cash_flow_engine": false,
  "payment_plans": false,
  "whatsapp_reminders": false,
  "cbc_rubrics": false,
  "auto_comments": false
}';

-- ==========================================
-- RLS Policies
-- ==========================================

ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_stk_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbc_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_comment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_report_comments ENABLE ROW LEVEL SECURITY;

-- Helper function for RLS
CREATE OR REPLACE FUNCTION get_school_id()
RETURNS BIGINT AS $$
  SELECT NULLIF(current_setting('app.current_school_id', true), '')::BIGINT;
$$ LANGUAGE sql STABLE;

-- Create policies
CREATE POLICY payment_plans_isolation ON payment_plans FOR ALL TO authenticated 
  USING (school_id = get_school_id());
CREATE POLICY installments_isolation ON payment_plan_installments FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM payment_plans WHERE plan_id = payment_plan_installments.plan_id AND school_id = get_school_id()));
CREATE POLICY pledges_isolation ON pledges FOR ALL TO authenticated 
  USING (school_id = get_school_id());
CREATE POLICY reminders_isolation ON reminder_logs FOR ALL TO authenticated 
  USING (school_id = get_school_id());
CREATE POLICY templates_isolation ON reminder_templates FOR ALL TO authenticated 
  USING (school_id IS NULL OR school_id = get_school_id());
CREATE POLICY forecast_isolation ON forecast_snapshots FOR ALL TO authenticated 
  USING (school_id = get_school_id());
CREATE POLICY stk_isolation ON pending_stk_transactions FOR ALL TO authenticated 
  USING (school_id = get_school_id());
CREATE POLICY rubrics_isolation ON cbc_rubrics FOR ALL TO authenticated 
  USING (school_id IS NULL OR school_id = get_school_id());
CREATE POLICY comment_templates_isolation ON report_comment_templates FOR ALL TO authenticated 
  USING (school_id IS NULL OR school_id = get_school_id());
CREATE POLICY generated_comments_isolation ON generated_report_comments FOR ALL TO authenticated 
  USING (school_id = get_school_id());

-- ==========================================
-- Seed Default Templates
-- ==========================================

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
 '["parent_name", "amount", "promised_date", "student_name"]')
ON CONFLICT DO NOTHING;

-- ==========================================
-- Done
-- ==========================================
SELECT 'Cash-Flow Engine + CBC AI schema migration complete' as status;
