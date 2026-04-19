-- ===========================================
-- CONSOLIDATED EDUCORE DATABASE SCHEMA
-- All tables in one optimized script
-- Run this in Supabase SQL Editor
-- ===========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- CORE TABLES
-- ===========================================

-- Schools table (multi-tenant support)
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table with role-based access
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'parent', 'student', 'finance', 'hr', 'librarian')),
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level TEXT,
    capacity INTEGER DEFAULT 30,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);

-- Students table (enhanced with new fields)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    admission_number TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    date_of_birth DATE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    parent_name TEXT,
    parent_phone TEXT,
    parent_email TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
    -- Enhanced fields
    nemis_number TEXT,
    blood_group TEXT DEFAULT 'Unknown' CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown')),
    allergies TEXT DEFAULT 'None',
    medical_conditions TEXT DEFAULT 'None',
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, admission_number)
);

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    employee_number TEXT,
    qualification TEXT,
    subjects TEXT[], -- Array of subjects
    hire_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- ACADEMIC TABLES
-- ===========================================

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);

-- Grades/Results table
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    grade TEXT,
    exam_type TEXT DEFAULT 'Regular',
    exam_date DATE,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, term, academic_year, exam_type)
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, date)
);

-- ===========================================
-- FINANCIAL TABLES
-- ===========================================

-- Fee structures table
CREATE TABLE IF NOT EXISTS fee_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    fee_type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, class_name, term, academic_year, fee_type)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'mpesa', 'bank_transfer', 'cheque', 'mobile_money', 'online')),
    transaction_id TEXT UNIQUE,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    fee_type TEXT NOT NULL,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    receipt_number TEXT UNIQUE,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee balances table (calculated)
CREATE TABLE IF NOT EXISTS fee_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    total_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_payment_date DATE,
    last_payment_amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, term, academic_year, school_id)
);

-- ===========================================
-- NEW FEATURE TABLES
-- ===========================================

-- Pending updates table (parent update requests)
CREATE TABLE IF NOT EXISTS pending_updates (
    id TEXT PRIMARY KEY DEFAULT generate_update_id(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by UUID REFERENCES users(id) ON DELETE CASCADE,
    requested_by_role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    UNIQUE(student_id, field, school_id, status) WHERE (status = 'pending')
);

-- Performance summary table (calculated metrics)
CREATE TABLE IF NOT EXISTS performance_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    average_score DECIMAL(5,2),
    total_subjects INTEGER,
    attendance_rate DECIMAL(5,2),
    class_position INTEGER,
    total_students INTEGER,
    last_exam_date DATE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, term, academic_year, school_id)
);

-- Audit log table (change tracking)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id) ON DELETE CASCADE,
    changed_by_role TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

-- ===========================================
-- COMMUNICATION TABLES
-- ===========================================

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'urgent', 'academic', 'financial')),
    target_audience TEXT[] DEFAULT '[]',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS logs table
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- UTILITY TABLES
-- ===========================================

-- Timetable table
CREATE TABLE IF NOT EXISTS timetable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_time > start_time)
);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

-- Core tables indexes
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_school_id ON grades(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_term_year ON grades(term, academic_year);

CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_school_id ON attendance(school_id);

CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_school_id ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- New feature indexes
CREATE INDEX IF NOT EXISTS idx_pending_updates_student_id ON pending_updates(student_id);
CREATE INDEX IF NOT EXISTS idx_pending_updates_school_id ON pending_updates(school_id);
CREATE INDEX IF NOT EXISTS idx_pending_updates_status ON pending_updates(status);

CREATE INDEX IF NOT EXISTS idx_performance_summary_student_id ON performance_summary(student_id);
CREATE INDEX IF NOT EXISTS idx_performance_summary_school_id ON performance_summary(school_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_school_id ON audit_log(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at);

-- ===========================================
-- VIEWS FOR REPORTING
-- ===========================================

-- Payment history view
CREATE OR REPLACE VIEW payment_history AS
SELECT 
    p.id,
    p.school_id,
    p.student_id,
    s.first_name || ' ' || s.last_name as student_name,
    s.admission_number,
    c.name as class_name,
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
    fb.status as fee_status
FROM payments p
JOIN students s ON p.student_id = s.id
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN fee_balances fb ON p.student_id = fb.student_id 
    AND p.term = fb.term 
    AND p.academic_year = fb.academic_year
    AND p.school_id = fb.school_id;

-- Student performance view
CREATE OR REPLACE VIEW student_performance AS
SELECT 
    s.id as student_id,
    s.school_id,
    s.admission_number,
    s.first_name || ' ' || s.last_name as student_name,
    c.name as class_name,
    COALESCE(ps.average_score, 0) as average_score,
    COALESCE(ps.total_subjects, 0) as total_subjects,
    COALESCE(ps.attendance_rate, 0) as attendance_rate,
    ps.class_position,
    ps.total_students,
    ps.last_exam_date,
    fb.balance as fee_balance,
    fb.status as fee_status
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN performance_summary ps ON s.id = ps.student_id 
    AND ps.term = (SELECT MAX(term) FROM performance_summary WHERE student_id = s.id)
    AND ps.academic_year = (SELECT MAX(academic_year) FROM performance_summary WHERE student_id = s.id)
LEFT JOIN fee_balances fb ON s.id = fb.student_id 
    AND fb.term = (SELECT MAX(term) FROM fee_balances WHERE student_id = s.id)
    AND fb.academic_year = (SELECT MAX(academic_year) FROM fee_balances WHERE student_id = s.id);

-- ===========================================
-- FUNCTIONS AND TRIGGERS
-- ===========================================

-- Function to generate update ID
CREATE OR REPLACE FUNCTION generate_update_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'update_' || EXTRACT(EPOCH FROM NOW())::TEXT || '_' || substr(md5(random()::TEXT), 1, 8);
END;
$$ LANGUAGE plpgsql;

-- Function to update fee balance when payment is made
CREATE OR REPLACE FUNCTION update_fee_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO fee_balances (school_id, student_id, term, academic_year, total_fees, amount_paid, balance, last_payment_date, last_payment_amount, status)
    VALUES (
        NEW.school_id,
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
        END
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

-- Function to log changes to audit_log
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        school_id,
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        changed_by,
        changed_by_role,
        reason
    ) VALUES (
        COALESCE(NEW.school_id, OLD.school_id, current_setting('app.current_school_id', 'default-school')),
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        COALESCE(NEW.created_by, OLD.created_by, current_setting('app.current_user_id', 'system')),
        COALESCE(NEW.created_by_role, OLD.created_by_role, current_setting('app.current_user_role', 'system')),
        COALESCE(NEW.reason, OLD.reason, NULL)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS payment_fee_balance_trigger ON payments;
CREATE TRIGGER payment_fee_balance_trigger
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW 
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_fee_balance_on_payment();

-- Audit triggers for key tables
DROP TRIGGER IF EXISTS audit_students_trigger ON students;
CREATE TRIGGER audit_students_trigger
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_payments_trigger ON payments;
CREATE TRIGGER audit_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_pending_updates_trigger ON pending_updates;
CREATE TRIGGER audit_pending_updates_trigger
AFTER INSERT OR UPDATE OR DELETE ON pending_updates
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (these should be customized based on your security requirements)
CREATE POLICY "Users can view their own school data" ON users
    FOR SELECT USING (school_id = current_setting('app.current_school_id', 'default-school'));

CREATE POLICY "Admins can manage all data" ON users
    FOR ALL USING (
        school_id = current_setting('app.current_school_id', 'default-school') AND
        current_setting('app.current_user_role', 'student') = 'admin'
    );

-- Similar policies would be created for other tables...

-- ===========================================
-- COMPLETION
-- ===========================================

DO $$
BEGIN
    RAISE NOTICE 'EduCore consolidated database schema created successfully!';
    RAISE NOTICE 'Tables created: schools, users, classes, students, teachers, subjects, grades, attendance, payments, fee_structures, fee_balances, pending_updates, performance_summary, audit_log, announcements, sms_logs, timetable';
    RAISE NOTICE 'Views created: payment_history, student_performance';
    RAISE NOTICE 'Functions and triggers created for automatic updates';
    RAISE NOTICE 'Indexes created for performance optimization';
    RAISE NOTICE 'Row Level Security enabled with basic policies';
END $$;
