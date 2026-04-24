-- ============================================================================
-- EduCore: Close Term Transaction Function
-- Critical: Handles term closure with atomic operations
-- Dependencies: academic_years, terms, results, fee_carry_forwards, 
--               fee_balance_ledger, term_transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION close_term_transaction(
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
  v_next_term_id BIGINT;
  v_next_term RECORD;
  v_carry_forward_count INTEGER := 0;
  v_locked_grades_count INTEGER := 0;
  v_result JSONB;
  v_year_label VARCHAR(20);
BEGIN
  -- Validate user permissions (must be director or delegated admin)
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE user_id = p_triggered_by 
    AND role IN ('director', 'admin')
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only director or admin can close terms';
  END IF;

  -- Start transaction - lock term row for update
  SELECT * INTO v_term 
  FROM terms 
  WHERE term_id = p_term_id 
  FOR UPDATE;
  
  -- Validate term exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Term not found: %', p_term_id;
  END IF;
  
  -- Validate term is 'active'
  IF v_term.status != 'active' THEN
    RAISE EXCEPTION 'Term must be active to close. Current status: %', v_term.status;
  END IF;
  
  v_school_id := v_term.school_id;
  
  -- Get academic year info
  SELECT * INTO v_academic_year
  FROM academic_years
  WHERE academic_year_id = v_term.academic_year_id;
  
  v_year_label := v_academic_year.year_label;
  
  -- Validate no pending grade entries (optional: make this a warning)
  -- Get count of unlocked grades for this term
  SELECT COUNT(*) INTO v_locked_grades_count
  FROM results r
  JOIN students s ON r.student_id = s.student_id
  WHERE s.school_id = v_school_id
    AND r.term = v_term.term_name
    AND r.academic_year = v_year_label
    AND (r.is_locked = false OR r.is_locked IS NULL);
  
  -- Log warning if there are unlocked grades (but don't block)
  IF v_locked_grades_count > 0 THEN
    RAISE WARNING 'Closing term with % unlocked grade entries', v_locked_grades_count;
  END IF;
  
  -- 1. Freeze all grade entries for this term
  UPDATE results 
  SET is_locked = TRUE, 
      locked_at = NOW(),
      locked_by = p_triggered_by,
      updated_at = NOW()
  FROM students s
  WHERE results.student_id = s.student_id
    AND s.school_id = v_school_id
    AND results.term = v_term.term_name
    AND results.academic_year = v_year_label;
  
  GET DIAGNOSTICS v_locked_grades_count = ROW_COUNT;
  
  -- 2. Find next term
  SELECT * INTO v_next_term
  FROM terms
  WHERE academic_year_id = v_term.academic_year_id
    AND term_order = v_term.term_order + 1
    AND school_id = v_school_id;
  
  IF FOUND THEN
    v_next_term_id := v_next_term.term_id;
  END IF;
  
  -- 3. Calculate and create carry-forwards (only if there's a next term)
  IF v_next_term_id IS NOT NULL THEN
    
    -- Get students with positive balance
    WITH student_balances AS (
      SELECT 
        s.student_id,
        s.school_id,
        COALESCE(
          (SELECT SUM(amount) FROM fee_balance_ledger 
           WHERE student_id = s.student_id 
           AND academic_year_id = v_term.academic_year_id
           AND term_id = p_term_id
           AND transaction_type = 'charge'),
          0
        ) - COALESCE(
          (SELECT SUM(amount) FROM fee_balance_ledger 
           WHERE student_id = s.student_id 
           AND academic_year_id = v_term.academic_year_id
           AND term_id = p_term_id
           AND transaction_type = 'payment'),
          0
        ) as balance
      FROM students s
      WHERE s.school_id = v_school_id
        AND s.status = 'active'
        AND s.is_deleted = false
    ),
    balances_to_carry AS (
      SELECT student_id, school_id, balance
      FROM student_balances
      WHERE balance > 0
    )
    -- Insert carry-forward records
    INSERT INTO fee_carry_forwards (
      school_id, 
      student_id, 
      from_term_id, 
      to_term_id, 
      amount, 
      reason,
      processed_at
    )
    SELECT 
      school_id,
      student_id,
      p_term_id,
      v_next_term_id,
      balance,
      COALESCE(p_reason, 'Unpaid balance carry forward'),
      NOW()
    FROM balances_to_carry;
    
    GET DIAGNOSTICS v_carry_forward_count = ROW_COUNT;
    
    -- 4. Create ledger entries for carry-forwards
    INSERT INTO fee_balance_ledger (
      school_id, 
      student_id, 
      academic_year_id, 
      term_id,
      transaction_type, 
      amount, 
      balance_before, 
      balance_after,
      reference_type, 
      reference_id, 
      description, 
      created_by,
      transaction_date
    )
    SELECT 
      v_school_id,
      fcf.student_id,
      v_term.academic_year_id,
      p_term_id,
      'carry_forward',
      fcf.amount,
      fcf.amount,  -- Balance before was the unpaid amount
      0,           -- Balance after is 0 (carried to next term)
      'term_carry',
      fcf.carry_forward_id,
      'Balance carried to next term: ' || v_next_term.term_name,
      p_triggered_by,
      CURRENT_DATE
    FROM fee_carry_forwards fcf
    WHERE fcf.from_term_id = p_term_id
      AND fcf.created_at > NOW() - INTERVAL '1 minute';  -- Only records just created
    
  END IF;
  
  -- 5. Update term status to completed
  UPDATE terms 
  SET status = 'completed', 
      is_current = FALSE,
      updated_at = NOW()
  WHERE term_id = p_term_id;
  
  -- 6. Log transition
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
    'close', 
    p_triggered_by,
    jsonb_build_object(
      'reason', p_reason,
      'grades_locked', v_locked_grades_count,
      'carry_forwards_created', v_carry_forward_count,
      'next_term_id', v_next_term_id
    ),
    NOW()
  );
  
  -- 7. Set next term as active (if exists)
  IF v_next_term_id IS NOT NULL THEN
    UPDATE terms 
    SET status = 'active', 
        is_current = TRUE,
        updated_at = NOW()
    WHERE term_id = v_next_term_id;
    
    -- Log the open transition for next term
    INSERT INTO term_transitions (
      school_id, 
      term_id, 
      transition_type, 
      triggered_by, 
      transition_data,
      created_at
    ) VALUES (
      v_school_id, 
      v_next_term_id, 
      'open', 
      p_triggered_by,
      jsonb_build_object(
        'previous_term_id', p_term_id,
        'auto_opened', true
      ),
      NOW()
    );
  END IF;
  
  -- Prepare result
  v_result := jsonb_build_object(
    'success', TRUE,
    'term_id', p_term_id,
    'term_name', v_term.term_name,
    'academic_year_id', v_term.academic_year_id,
    'grades_locked', v_locked_grades_count,
    'carry_forwards_created', v_carry_forward_count,
    'next_term_id', v_next_term_id,
    'next_term_name', v_next_term.term_name,
    'transition_logged', TRUE
  );
  
  RETURN v_result;
  
EXCEPTION 
  WHEN OTHERS THEN
    -- Log the error for debugging
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
      'close', 
      p_triggered_by,
      jsonb_build_object(
        'error', TRUE,
        'error_message', SQLERRM,
        'reason', p_reason
      ),
      NOW()
    );
    
    -- Re-raise the error
    RAISE;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION close_term_transaction IS 
'Atomically closes a term: locks grades, calculates carry-forwards, creates ledger entries, 
and activates the next term. Returns JSON with operation summary. 
Throws exception on validation failure or if term is not active.';

-- Grant execute permission to authenticated users (RLS will enforce school isolation)
GRANT EXECUTE ON FUNCTION close_term_transaction TO authenticated;
