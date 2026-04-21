-- Check existing schools to get correct school_id
-- Run this first to find your school_id

SELECT school_id, name, code FROM public.schools WHERE is_deleted = false ORDER BY school_id;
