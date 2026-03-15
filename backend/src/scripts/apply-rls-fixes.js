import { pgPool } from '../config/pg.js';

async function applyRLSFixes() {
  console.log('🔧 Applying RLS security fixes...');
  
  try {
    // Step 1: Create session reset function
    await pgPool.query(`
      CREATE OR REPLACE FUNCTION reset_tenant_session()
      RETURNS void AS $$
      BEGIN
          PERFORM set_config('app.current_school_id', NULL, false);
          PERFORM set_config('app.current_user_id', NULL, false);
          PERFORM set_config('app.current_role', NULL, false);
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Session reset function created');

    // Step 2: Enable RLS and create policies for results table
    await pgPool.query(`ALTER TABLE public.results ENABLE ROW LEVEL SECURITY`);
    
    // Drop existing policies
    await pgPool.query(`DROP POLICY IF EXISTS "Users can view results from their school only" ON public.results`);
    await pgPool.query(`DROP POLICY IF EXISTS "Users can insert results for their school only" ON public.results`);
    await pgPool.query(`DROP POLICY IF EXISTS "Users can update results from their school only" ON public.results`);
    await pgPool.query(`DROP POLICY IF EXISTS "Users can delete results from their school only" ON public.results`);
    
    // Create comprehensive RLS policies
    await pgPool.query(`
      CREATE POLICY "Users can view results from their school only" ON public.results
        FOR SELECT
        USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    
    await pgPool.query(`
      CREATE POLICY "Users can insert results for their school only" ON public.results
        FOR INSERT
        WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    
    await pgPool.query(`
      CREATE POLICY "Users can update results from their school only" ON public.results
        FOR UPDATE
        USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
        WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    
    await pgPool.query(`
      CREATE POLICY "Users can delete results from their school only" ON public.results
        FOR DELETE
        USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    console.log('✅ Results table RLS policies created');

    // Step 3: Standardize activity_logs RLS (uses created_at column)
    await pgPool.query(`ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY`);
    
    // Drop old inconsistent policies
    await pgPool.query(`DROP POLICY IF EXISTS "Users can view activity logs from their school only" ON public.activity_logs`);
    await pgPool.query(`DROP POLICY IF EXISTS "System can insert activity logs" ON public.activity_logs`);
    await pgPool.query(`DROP POLICY IF EXISTS "No updates to activity logs" ON public.activity_logs`);
    await pgPool.query(`DROP POLICY IF EXISTS "No deletes to activity logs" ON public.activity_logs`);
    
    // Create consistent JWT-based policies
    await pgPool.query(`
      CREATE POLICY "Users can view activity logs from their school only" ON public.activity_logs
        FOR SELECT
        USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    
    await pgPool.query(`
      CREATE POLICY "System can insert activity logs" ON public.activity_logs
        FOR INSERT
        WITH CHECK (true)
    `);
    
    await pgPool.query(`
      CREATE POLICY "No updates to activity logs" ON public.activity_logs
        FOR UPDATE
        USING (false)
    `);
    
    await pgPool.query(`
      CREATE POLICY "No deletes to activity logs" ON public.activity_logs
        FOR DELETE
        USING (false)
    `);
    console.log('✅ Activity logs RLS policies standardized');

    // Step 4: Standardize audit_logs RLS (uses timestamp column)
    await pgPool.query(`ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY`);
    
    // Drop old inconsistent policy
    await pgPool.query(`DROP POLICY IF EXISTS audit_logs_school_isolation ON public.audit_logs`);
    
    // Create consistent JWT-based policies
    await pgPool.query(`
      CREATE POLICY "Users can view audit logs from their school only" ON public.audit_logs
        FOR SELECT
        USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    
    await pgPool.query(`
      CREATE POLICY "System can insert audit logs" ON public.audit_logs
        FOR INSERT
        WITH CHECK (true)
    `);
    
    await pgPool.query(`
      CREATE POLICY "No updates to audit logs" ON public.audit_logs
        FOR UPDATE
        USING (false)
    `);
    
    await pgPool.query(`
      CREATE POLICY "No deletes to audit logs" ON public.audit_logs
        FOR DELETE
        USING (false)
    `);
    console.log('✅ Audit logs RLS policies standardized');

    // Step 4: Standardize student_ledger RLS
    await pgPool.query(`DROP POLICY IF EXISTS "Users can view ledger entries from their school only" ON public.student_ledger`);
    await pgPool.query(`DROP POLICY IF EXISTS "Users can insert ledger entries for their school only" ON public.student_ledger`);
    await pgPool.query(`DROP POLICY IF EXISTS "Users can update ledger entries from their school only" ON public.student_ledger`);
    await pgPool.query(`DROP POLICY IF EXISTS "Users can delete ledger entries from their school only" ON public.student_ledger`);
    
    await pgPool.query(`
      CREATE POLICY "Users can view ledger entries from their school only" ON public.student_ledger
        FOR SELECT
        USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    
    await pgPool.query(`
      CREATE POLICY "Users can insert ledger entries for their school only" ON public.student_ledger
        FOR INSERT
        WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    
    await pgPool.query(`
      CREATE POLICY "Users can update ledger entries from their school only" ON public.student_ledger
        FOR UPDATE
        USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
        WITH CHECK (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    
    await pgPool.query(`
      CREATE POLICY "Users can delete ledger entries from their school only" ON public.student_ledger
        FOR DELETE
        USING (school_id = (auth.jwt() ->> 'school_id')::bigint)
    `);
    console.log('✅ Student ledger RLS policies standardized');

    // Step 5: Add performance indexes with correct column names
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_results_school_term ON public.results (school_id, term)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_results_school_student_term ON public.results (school_id, student_id, term)`);
    
    // Fixed: activity_logs uses created_at, not timestamp
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_school_created_at ON public.activity_logs (school_id, created_at)`);
    
    // audit_logs uses timestamp column
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_school_timestamp ON public.audit_logs (school_id, timestamp)`);
    
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_student_ledger_school_student ON public.student_ledger (school_id, student_id)`);
    console.log('✅ Performance indexes added');

    // Step 6: Verification
    const { rows } = await pgPool.query(`
      SELECT 
          schemaname,
          tablename,
          policyname,
          cmd,
          CASE 
              WHEN qual LIKE '%auth.jwt()%' THEN 'JWT-based ✓'
              WHEN qual LIKE '%current_setting%' THEN 'Session-based ⚠️'
              ELSE 'Unknown ❌'
          END as pattern_type
      FROM pg_policies 
      WHERE tablename IN ('students', 'payments', 'users', 'attendance', 'fee_structures', 
                         'classes', 'activity_logs', 'audit_logs', 'results', 'student_ledger')
      ORDER BY tablename, cmd
    `);

    console.log('\n📊 RLS Policies Status:');
    console.table(rows);

    // Check for inconsistent patterns
    const { rows: inconsistent } = await pgPool.query(`
      SELECT tablename, policyname, qual
      FROM pg_policies 
      WHERE qual LIKE '%current_setting%'
      AND tablename IN ('students', 'payments', 'users', 'attendance', 'fee_structures', 
                       'classes', 'activity_logs', 'audit_logs', 'results', 'student_ledger')
    `);

    if (inconsistent.length > 0) {
      console.log('\n⚠️ Inconsistent patterns found:');
      console.table(inconsistent);
    } else {
      console.log('\n✅ All RLS policies use consistent JWT-based patterns');
    }

    console.log('\n🎉 RLS security fixes completed successfully!');
    
  } catch (error) {
    console.error('❌ Error applying RLS fixes:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  applyRLSFixes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { applyRLSFixes };
