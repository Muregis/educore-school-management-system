-- UPGRADE HR PAYSLIPS FOR PROFESSIONAL PAYMENTS
ALTER TABLE public.hr_payslips 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

-- ENSURE INDEX FOR FAST EXPORTS
CREATE INDEX IF NOT EXISTS idx_payslips_month_year ON public.hr_payslips(school_id, month, year);
