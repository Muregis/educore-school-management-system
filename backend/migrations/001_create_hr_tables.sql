-- HR and Payroll Tables for EduCore
-- These tables support staff management, leave tracking, and payroll processing

-- HR Staff table for employee records
CREATE TABLE IF NOT EXISTS hr_staff (
    staff_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT DEFAULT 'Academic',
    job_title TEXT NOT NULL,
    contract_type TEXT DEFAULT 'Permanent', -- Permanent, Contract, Probation
    start_date DATE,
    end_date DATE, -- For contract staff
    salary DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, inactive, terminated
    national_id TEXT,
    bank_name TEXT,
    bank_account TEXT,
    bank_branch TEXT,
    kra_pin TEXT, -- Kenya Revenue Authority PIN
    nssf_number TEXT, -- National Social Security Fund
    nhif_number TEXT, -- National Hospital Insurance Fund
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HR Leave table for leave management
CREATE TABLE IF NOT EXISTS hr_leave (
    leave_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES hr_staff(staff_id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL, -- Annual, Sick, Maternity, Paternity, Emergency
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    days_applied INTEGER NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, cancelled
    approved_by BIGINT REFERENCES users(user_id), -- User who approved
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    attachment_url TEXT, -- For supporting documents
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll table for salary processing
CREATE TABLE IF NOT EXISTS payroll (
    payroll_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES hr_staff(staff_id) ON DELETE CASCADE,
    pay_period TEXT NOT NULL, -- e.g., "2024-01", "2024-February"
    basic_salary DECIMAL(12,2) NOT NULL,
    house_allowance DECIMAL(12,2) DEFAULT 0,
    transport_allowance DECIMAL(12,2) DEFAULT 0,
    other_allowances DECIMAL(12,2) DEFAULT 0,
    gross_pay DECIMAL(12,2) NOT NULL,
    paye_tax DECIMAL(12,2) DEFAULT 0, -- PAYE tax deduction
    nssf_deduction DECIMAL(12,2) DEFAULT 0,
    nhif_deduction DECIMAL(12,2) DEFAULT 0,
    other_deductions DECIMAL(12,2) DEFAULT 0,
    total_deductions DECIMAL(12,2) DEFAULT 0,
    net_pay DECIMAL(12,2) NOT NULL,
    payment_date DATE,
    payment_method TEXT DEFAULT 'bank', -- bank, cash, cheque
    payment_status TEXT DEFAULT 'pending', -- pending, paid, failed
    bank_reference TEXT,
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll Items table for detailed breakdown of allowances and deductions
CREATE TABLE IF NOT EXISTS payroll_items (
    item_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    payroll_id BIGINT NOT NULL REFERENCES payroll(payroll_id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- allowance, deduction
    item_name TEXT NOT NULL, -- House Allowance, Transport, PAYE, NSSF, etc.
    amount DECIMAL(12,2) NOT NULL,
    is_taxable BOOLEAN DEFAULT FALSE, -- For allowances
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave Balance table to track leave entitlements
CREATE TABLE IF NOT EXISTS leave_balances (
    balance_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    school_id BIGINT NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES hr_staff(staff_id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    total_days INTEGER NOT NULL DEFAULT 0, -- Annual entitlement
    used_days INTEGER NOT NULL DEFAULT 0,
    remaining_days INTEGER GENERATED ALWAYS AS (total_days - used_days) STORED,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, staff_id, leave_type, year)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hr_staff_school_id ON hr_staff(school_id);
CREATE INDEX IF NOT EXISTS idx_hr_staff_status ON hr_staff(status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_school_id ON hr_leave(school_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_staff_id ON hr_leave(staff_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_status ON hr_leave(status);
CREATE INDEX IF NOT EXISTS idx_payroll_school_id ON payroll(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_staff_id ON payroll(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll(pay_period);
CREATE INDEX IF NOT EXISTS idx_leave_balances_school_id ON leave_balances(school_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_staff_id ON leave_balances(staff_id);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE hr_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hr_staff
CREATE POLICY "Schools can view their staff" ON hr_staff
    FOR SELECT USING (school_id = current_setting('app.current_school_id')::BIGINT AND is_deleted = FALSE);

CREATE POLICY "Schools can insert their staff" ON hr_staff
    FOR INSERT WITH CHECK (school_id = current_setting('app.current_school_id')::BIGINT);

CREATE POLICY "Schools can update their staff" ON hr_staff
    FOR UPDATE USING (school_id = current_setting('app.current_school_id')::BIGINT);

CREATE POLICY "Schools can delete their staff" ON hr_staff
    FOR DELETE USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- RLS Policies for hr_leave
CREATE POLICY "Schools can view leave records" ON hr_leave
    FOR SELECT USING (school_id = current_setting('app.current_school_id')::BIGINT AND is_deleted = FALSE);

CREATE POLICY "Schools can insert leave records" ON hr_leave
    FOR INSERT WITH CHECK (school_id = current_setting('app.current_school_id')::BIGINT);

CREATE POLICY "Schools can update leave records" ON hr_leave
    FOR UPDATE USING (school_id = current_setting('app.current_school_id')::BIGINT);

CREATE POLICY "Schools can delete leave records" ON hr_leave
    FOR DELETE USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- RLS Policies for payroll
CREATE POLICY "Schools can view payroll records" ON payroll
    FOR SELECT USING (school_id = current_setting('app.current_school_id')::BIGINT AND is_deleted = FALSE);

CREATE POLICY "Schools can insert payroll records" ON payroll
    FOR INSERT WITH CHECK (school_id = current_setting('app.current_school_id')::BIGINT);

CREATE POLICY "Schools can update payroll records" ON payroll
    FOR UPDATE USING (school_id = current_setting('app.current_school_id')::BIGINT);

CREATE POLICY "Schools can delete payroll records" ON payroll
    FOR DELETE USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- RLS Policies for payroll_items
CREATE POLICY "Schools can view payroll items" ON payroll_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM payroll 
            WHERE payroll.payroll_id = payroll_items.payroll_id 
            AND payroll.school_id = current_setting('app.current_school_id')::BIGINT
        )
    );

CREATE POLICY "Schools can manage payroll items" ON payroll_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM payroll 
            WHERE payroll.payroll_id = payroll_items.payroll_id 
            AND payroll.school_id = current_setting('app.current_school_id')::BIGINT
        )
    );

-- RLS Policies for leave_balances
CREATE POLICY "Schools can view leave balances" ON leave_balances
    FOR SELECT USING (school_id = current_setting('app.current_school_id')::BIGINT AND is_deleted = FALSE);

CREATE POLICY "Schools can manage leave balances" ON leave_balances
    FOR ALL USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_hr_staff_updated_at BEFORE UPDATE ON hr_staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hr_leave_updated_at BEFORE UPDATE ON hr_leave
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON payroll
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
