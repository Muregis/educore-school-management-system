-- ============================================================================
-- EduCore: Lock Term Transaction Function
-- Makes a term immutable after all processing is complete
-- ============================================================================

CREATE OR REPLACE FUNCTION lock_term_transaction(
  p_term_id BIGINT,
  p_triggered_by BIGINT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_term RECORD;
  v_academic_year RECORD;
  v_school_id BIGINT;
  v_pending_promotions INTEGER := 0;
  v_unreconciled_payments INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Validate user permissions
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE user_id = p_triggered_by 
    AND role IN ('director', 'admin')
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only director or admin can lock terms';
  END IF;

  -- Lock and get term
  SELECT * INTO v_term 
  FROM terms 
  WHERE term_id = p_term_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Term not found: %', p_term_id;
  END IF;
  
  -- Validate term is 'completed'
  IF v_term.status != 'completed' THEN
    RAISE EXCEPTION 'Term must be completed before locking. Current status: %', v_term.status;
  END IF;
  
  v_school_id := v_term.school_id;
  
  -- Get academic year info
  SELECT * INTO v_academic_year
  FROM academic_years
  WHERE academic_year_id = v_term.academic_year_id;
  
  -- Check for pending promotions (if this is the last term of academic year)
  IF v_term.term_order = 3 THEN
    SELECT COUNT(*) INTO v_pending_promotions
    FROM students s
    WHERE s.school_id = v_school_id
      AND s.status = 'active'
      AND s.is_deleted = false
      AND NOT EXISTS (
        SELECT 1 FROM promotion_decisions pd
        WHERE pd.student_id = s.student_id
        AND pd.academic_year_id = v_term.academic_year_id
        AND pd.is_deleted = false
      );
    
    IF v_pending_promotions > 0 THEN
      RAISE EXCEPTION 'Cannot lock term: % students pending promotion decisions', v_pending_promotions;
    END IF;
  END IF;
  
  -- Check for unreconciled payments
  SELECT COUNT(*) INTO v_unreconciled_payments
  FROM payments p
  JOIN students s ON p.student_id = s.student_id
  WHERE s.school_id = v_school_id
    AND p.term = v_term.term_name
    AND p.status = 'pending'
    AND p.is_deleted = false;
  
  IF v_unreconciled_payments > 0 THEN
    RAISE WARNING 'Locking term with % unreconciled payments', v_unreconciled_payments;
  END IF;
  
  -- Update term status to locked
  UPDATE terms 
  SET status = 'locked', 
      is_current = FALSE,
      updated_at = NOW()
  WHERE term_id = p_term_id;
  
  -- Log transition
  INSERT INTO term_transitions (
    school_id, 
    term_id, 
    transition_type, 
    triggered_by, 
    transition_data,
    created_at
  ) VALUES (
    v_school_id, 
    p_term_id, 
    'lock', 
    p_triggered_by,
    jsonb_build_object(
      'reason', p_reason,
      'pending_promotions', v_pending_promotions,
      'unreconciled_payments', v_unreconciled_payments,
      'is_final_term', v_term.term_order = 3
    ),
    NOW()
  );
  
  -- Prepare result
  v_result := jsonb_build_object(
    'success', TRUE,
    'term_id', p_term_id,
    'term_name', v_term.term_name,
    'status', 'locked',
    'immutable', TRUE,
    'warnings', CASE 
      WHEN v_unreconciled_payments > 0 THEN 
        jsonb_build_array(format('%s unreconciled payments exist', v_unreconciled_payments))
      ELSE '[]'::jsonb
    END
  );
  
  RETURN v_result;
  
EXCEPTION 
  WHEN OTHERS THEN
    -- Log failure
    INSERT INTO term_transitions (
      school_id, 
      term_id, 
      transition_type, 
      triggered_by, 
      transition_data,
      created_at
    ) VALUES (
      v_school_id, 
      p_term_id, 
      'lock', 
      p_triggered_by,
      jsonb_build_object(
        'error', TRUE,
        'error_message', SQLERRM,
        'reason', p_reason
      ),
      NOW()
    );
    
    RAISE;
END;
$$;

COMMENT ON FUNCTION lock_term_transaction IS 
'Makes a completed term immutable. Validates no pending promotions (for term 3) 
and logs the lock transition. Returns JSON with lock confirmation.';

GRANT EXECUTE ON FUNCTION lock_term_transaction TO authenticated;
