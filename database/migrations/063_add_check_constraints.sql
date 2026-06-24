-- Add check constraints
BEGIN;

ALTER TABLE exam_results 
DROP CONSTRAINT IF EXISTS chk_exam_results_marks_range,
ADD CONSTRAINT chk_exam_results_marks_range 
CHECK (marks >= 0 AND marks <= 100);

ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS chk_payments_amount_positive,
ADD CONSTRAINT chk_payments_amount_positive 
CHECK (amount > 0);

ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS chk_invoices_total_positive,
ADD CONSTRAINT chk_invoices_total_positive 
CHECK (total >= 0);

COMMIT;
