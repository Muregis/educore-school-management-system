-- Phase 8: HR & Payroll
-- Create HR and payroll tables

-- Enhance hr_staff table
ALTER TABLE hr_staff 
ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS employment_status VARCHAR(20) DEFAULT 'active', -- active, suspended, terminated, resigned
ADD COLUMN IF NOT EXISTS termination_date DATE,
ADD COLUMN IF NOT EXISTS termination_reason TEXT,
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_sort_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS kra_pin VARCHAR(20),
ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS nhif_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS tsc_number VARCHAR(20);

-- Create payroll periods table
CREATE TABLE IF NOT EXISTS payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payroll_periods_school ON payroll_periods(school_id);
CREATE INDEX idx_payroll_periods_dates ON payroll_periods(start_date, end_date);

-- Create payroll table
CREATE TABLE IF NOT EXISTS payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id BIGINT NOT NULL,
    payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id),
    staff_id UUID NOT NULL REFERENCES hr_staff(id),
    basic_salary DECIMAL(15,2) NOT NULL,
    allowances DECIMAL(15,2) DEFAULT 0,
    deductions DECIMAL(15,2) DEFAULT 0,
    paye DECIMAL(15,2) DEFAULT 0,
    nssf DECIMAL(15,2) DEFAULT 0,
    nhif DECIMAL(15,2) DEFAULT 0,
    net_pay DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- draft, processed, paid
    processed_date DATE,
    paid_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payroll_school ON payroll(school_id);
CREATE INDEX idx_payroll_period ON payroll(payroll_period_id);
CREATE INDEX idx_payroll_staff ON payroll(staff_id);
CREATE INDEX idx_payroll_status ON payroll(status);

-- Create payroll items table (for detailed allowances/deductions)
CREATE TABLE IF NOT EXISTS payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- allowance, deduction, tax, benefit
    item_name VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT
);

CREATE INDEX idx_payroll_items_payroll ON payroll_items(payroll_id);
