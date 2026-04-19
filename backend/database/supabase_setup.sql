-- Supabase Database Setup for Enhanced Features
-- Run these SQL scripts in your Supabase SQL Editor

-- ===========================================
-- 1. ENHANCE STUDENTS TABLE
-- ===========================================

-- Add new columns to students table if they don't exist
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS nemis_number TEXT,
ADD COLUMN IF NOT EXISTS blood_group TEXT DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS allergies TEXT DEFAULT 'None',
ADD COLUMN IF NOT EXISTS medical_conditions TEXT DEFAULT 'None',
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
ADD COLUMN IF NOT EXISTS parent_email TEXT;

-- Add constraints for data integrity
ALTER TABLE students 
ADD CONSTRAINT IF NOT EXISTS students_blood_group_check 
CHECK (blood_group IS NULL OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_nemis_number ON students(nemis_number);
CREATE INDEX IF NOT EXISTS idx_students_parent_email ON students(parent_email);

-- ===========================================
-- 2. CREATE PENDING UPDATES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS pending_updates (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by TEXT NOT NULL,
    requested_by_role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    rejected_at TIMESTAMPTZ,
    rejected_by TEXT,
    rejection_reason TEXT,
    
    -- School-specific filtering
    school_id TEXT REFERENCES schools(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_updates_student_id ON pending_updates(student_id);
CREATE INDEX IF NOT EXISTS idx_pending_updates_status ON pending_updates(status);
CREATE INDEX IF NOT EXISTS idx_pending_updates_school_id ON pending_updates(school_id);

-- Create unique constraint to prevent duplicate pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_updates_unique_pending 
ON pending_updates(student_id, field, school_id) 
WHERE status = 'pending';

-- ===========================================
-- 3. CREATE AUDIT LOG TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by TEXT NOT NULL,
    changed_by_role TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,
    school_id TEXT REFERENCES schools(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_school_id ON audit_log(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at);

-- ===========================================
-- 4. CREATE PERFORMANCE SUMMARY TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS performance_summary (
    id BIGSERIAL PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    average_score DECIMAL(5,2),
    total_subjects INTEGER,
    attendance_rate DECIMAL(5,2),
    class_position INTEGER,
    total_students INTEGER,
    last_exam_date DATE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Unique constraint for student-term-year combination
    UNIQUE(student_id, term, academic_year, school_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_performance_summary_student_id ON performance_summary(student_id);
CREATE INDEX IF NOT EXISTS idx_performance_summary_term ON performance_summary(term);
CREATE INDEX IF NOT EXISTS idx_performance_summary_school_id ON performance_summary(school_id);

-- ===========================================
-- 5. CREATE FEE BALANCES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS fee_balances (
    id BIGSERIAL PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    total_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_payment_date DATE,
    last_payment_amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Unique constraint for student-term-year combination
    UNIQUE(student_id, term, academic_year, school_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fee_balances_student_id ON fee_balances(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_balances_school_id ON fee_balances(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_balances_status ON fee_balances(status);

-- ===========================================
-- 6. CREATE FEE STRUCTURES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS fee_structures (
    id BIGSERIAL PRIMARY KEY,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    fee_type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Unique constraint for class-term-year-fee_type combination
    UNIQUE(class_name, term, academic_year, fee_type, school_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fee_structures_class_name ON fee_structures(class_name);
CREATE INDEX IF NOT EXISTS idx_fee_structures_school_id ON fee_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_is_active ON fee_structures(is_active);

-- ===========================================
-- 7. CREATE VIEWS FOR REPORTING
-- ===========================================

-- Payment History View
CREATE OR REPLACE VIEW payment_history AS
SELECT 
    p.id,
    p.student_id,
    s.first_name || ' ' || s.last_name as student_name,
    s.admission_number,
    s.class_name,
    p.amount,
    p.payment_date,
    p.payment_method,
    p.transaction_id,
    p.term,
    p.academic_year,
    p.fee_type,
    p.status,
    p.receipt_number,
    p.notes,
    p.created_at,
    fb.total_fees,
    fb.amount_paid as total_paid,
    fb.balance as current_balance,
    fb.status as fee_status,
    p.school_id
FROM payments p
JOIN students s ON p.student_id = s.id
LEFT JOIN fee_balances fb ON p.student_id = fb.student_id 
    AND p.term = fb.term 
    AND p.academic_year = fb.academic_year
    AND p.school_id = fb.school_id;

-- Fee Structure Report View
CREATE OR REPLACE VIEW fee_structure_report AS
SELECT 
    fs.class_name,
    fs.term,
    fs.academic_year,
    fs.fee_type,
    fs.amount,
    fs.description,
    fs.is_required,
    fs.is_active,
    COUNT(s.id) as student_count,
    fs.amount * COUNT(s.id) as projected_revenue,
    COALESCE(SUM(p.amount), 0) as collected_amount,
    (fs.amount * COUNT(s.id)) - COALESCE(SUM(p.amount), 0) as pending_amount,
    fs.school_id
FROM fee_structures fs
LEFT JOIN students s ON s.class_name = fs.class_name AND s.status = 'active' AND s.school_id = fs.school_id
LEFT JOIN payments p ON p.student_id = s.id 
    AND p.term = fs.term 
    AND p.academic_year = fs.academic_year 
    AND p.fee_type = fs.fee_type
    AND p.status = 'completed'
    AND p.school_id = fs.school_id
WHERE fs.is_active = true
GROUP BY fs.class_name, fs.term, fs.academic_year, fs.fee_type, fs.amount, fs.description, fs.is_required, fs.is_active, fs.school_id
ORDER BY fs.class_name, fs.term, fs.fee_type;

-- ===========================================
-- 8. CREATE FUNCTIONS AND TRIGGERS
-- ===========================================

-- Function to update fee balance when payment is made
CREATE OR REPLACE FUNCTION update_fee_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Update fee_balances table
    INSERT INTO fee_balances (student_id, term, academic_year, total_fees, amount_paid, balance, last_payment_date, last_payment_amount, status, school_id)
    VALUES (
        NEW.student_id,
        NEW.term,
        NEW.academic_year,
        COALESCE((SELECT total_fees FROM fee_balances WHERE student_id = NEW.student_id AND term = NEW.term AND academic_year = NEW.academic_year AND school_id = NEW.school_id), 0),
        COALESCE((SELECT amount_paid FROM fee_balances WHERE student_id = NEW.student_id AND term = NEW.term AND academic_year = NEW.academic_year AND school_id = NEW.school_id), 0) + NEW.amount,
        COALESCE((SELECT balance FROM fee_balances WHERE student_id = NEW.student_id AND term = NEW.term AND academic_year = NEW.academic_year AND school_id = NEW.school_id), 0) - NEW.amount,
        NEW.payment_date,
        NEW.amount,
        CASE 
            WHEN COALESCE((SELECT balance FROM fee_balances WHERE student_id = NEW.student_id AND term = NEW.term AND academic_year = NEW.academic_year AND school_id = NEW.school_id), 0) - NEW.amount <= 0 THEN 'paid'
            WHEN COALESCE((SELECT balance FROM fee_balances WHERE student_id = NEW.student_id AND term = NEW.term AND academic_year = NEW.academic_year AND school_id = NEW.school_id), 0) - NEW.amount > 0 THEN 'partial'
            ELSE 'pending'
        END,
        NEW.school_id
    )
    ON CONFLICT (student_id, term, academic_year, school_id)
    DO UPDATE SET
        amount_paid = fee_balances.amount_paid + NEW.amount,
        balance = fee_balances.balance - NEW.amount,
        last_payment_date = NEW.payment_date,
        last_payment_amount = NEW.amount,
        status = CASE 
            WHEN fee_balances.balance - NEW.amount <= 0 THEN 'paid'
            WHEN fee_balances.balance - NEW.amount > 0 THEN 'partial'
            ELSE 'pending'
        END,
        calculated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic fee balance updates
DROP TRIGGER IF EXISTS payment_fee_balance_trigger ON payments;
CREATE TRIGGER payment_fee_balance_trigger
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW 
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_fee_balance_on_payment();

-- Function to log changes to audit_log
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into audit_log
    INSERT INTO audit_log (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        changed_by,
        changed_by_role,
        reason,
        school_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(OLD.id::TEXT, NEW.id::TEXT),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        COALESCE(NEW.created_by, OLD.created_by, 'system'),
        COALESCE(NEW.created_by_role, OLD.created_by_role, 'system'),
        COALESCE(NEW.reason, OLD.reason, NULL),
        COALESCE(NEW.school_id, OLD.school_id)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for key tables
DROP TRIGGER IF EXISTS audit_students_trigger ON students;
CREATE TRIGGER audit_students_trigger
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_pending_updates_trigger ON pending_updates;
CREATE TRIGGER audit_pending_updates_trigger
AFTER INSERT OR UPDATE OR DELETE ON pending_updates
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- ===========================================
-- 9. INSERT INITIAL DATA
-- ===========================================

-- Insert default fee structures for each class (if they don't exist)
INSERT INTO fee_structures (class_name, term, academic_year, fee_type, amount, description, is_required, school_id)
SELECT 
    class_name, 
    'Term 1', 
    '2025', 
    'tuition', 
    CASE 
        WHEN class_name IN ('Playgroup', 'PP1', 'PP2') THEN 15000
        WHEN class_name IN ('Grade 1', 'Grade 2') THEN 20000
        WHEN class_name IN ('Grade 3', 'Grade 4') THEN 25000
        WHEN class_name IN ('Grade 5', 'Grade 6') THEN 30000
        WHEN class_name IN ('Grade 7', 'Grade 8', 'Grade 9') THEN 35000
        ELSE 15000
    END,
    'Tuition fees for ' || class_name, 
    true, 
    'default-school'
FROM (VALUES 
    ('Playgroup'), ('PP1'), ('PP2'), ('Grade 1'), ('Grade 2'), ('Grade 3'), 
    ('Grade 4'), ('Grade 5'), ('Grade 6'), ('Grade 7'), ('Grade 8'), ('Grade 9')
) AS t(class_name)
WHERE NOT EXISTS (
    SELECT 1 FROM fee_structures 
    WHERE class_name = t.class_name 
    AND term = 'Term 1' 
    AND academic_year = '2025' 
    AND fee_type = 'tuition'
    AND school_id = 'default-school'
);

-- ===========================================
-- 10. ENABLE ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on all new tables
ALTER TABLE pending_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pending_updates
CREATE POLICY "Users can view pending updates for their school" ON pending_updates
    FOR SELECT USING (school_id = current_setting('app.current_school_id', 'default-school'));

CREATE POLICY "Admins can manage pending updates" ON pending_updates
    FOR ALL USING (
        school_id = current_setting('app.current_school_id', 'default-school') AND
        current_setting('app.current_user_role', 'student') = 'admin'
    );

-- RLS Policies for performance_summary
CREATE POLICY "Users can view performance summary for their school" ON performance_summary
    FOR SELECT USING (school_id = current_setting('app.current_school_id', 'default-school'));

-- RLS Policies for fee_balances
CREATE POLICY "Users can view fee balances for their school" ON fee_balances
    FOR SELECT USING (school_id = current_setting('app.current_school_id', 'default-school'));

-- RLS Policies for fee_structures
CREATE POLICY "Users can view fee structures for their school" ON fee_structures
    FOR SELECT USING (school_id = current_setting('app.current_school_id', 'default-school'));

-- RLS Policies for audit_log
CREATE POLICY "Admins can view audit log for their school" ON audit_log
    FOR SELECT USING (
        school_id = current_setting('app.current_school_id', 'default-school') AND
        current_setting('app.current_user_role', 'student') = 'admin'
    );

-- ===========================================
-- COMPLETION MESSAGE
-- ===========================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Supabase database setup completed successfully!';
    RAISE NOTICE 'Tables created: pending_updates, audit_log, performance_summary, fee_balances, fee_structures';
    RAISE NOTICE 'Views created: payment_history, fee_structure_report';
    RAISE NOTICE 'Functions and triggers created for automatic updates';
    RAISE NOTICE 'Row Level Security enabled with appropriate policies';
END $$;
