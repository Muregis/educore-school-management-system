-- Find potential duplicates (different cases)
SELECT school_id, LOWER(admission_number) as adm_lower, COUNT(*) as cnt
FROM students 
WHERE is_deleted = false 
GROUP BY school_id, LOWER(admission_number) 
HAVING COUNT(*) > 1;