import { pgPool } from '../config/pg.js';

async function analyzeDatabasePerformance() {
  console.log('🔍 Phase 4: Database Performance Safety Analysis');
  
  try {
    // Check existing tenant-aware indexes
    const indexResult = await pgPool.query(`
      SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
      FROM pg_indexes 
      WHERE tablename IN ('students', 'payments', 'users', 'attendance', 'results', 'activity_logs', 'audit_logs', 'student_ledger')
      AND indexdef LIKE '%school_id%'
      ORDER BY tablename, indexname
    `);

    console.log('\n📊 Existing Tenant-Aware Indexes:');
    console.table(indexResult.rows);

    // Analyze table sizes and tenant distribution
    const tables = ['students', 'payments', 'users', 'attendance', 'results', 'activity_logs'];
    
    for (const table of tables) {
      try {
        let query = `
          SELECT 
              '${table}' as table_name,
              COUNT(*) as total_rows,
              COUNT(DISTINCT school_id) as unique_schools,
              MAX(created_at) as latest_record
          FROM ${table}
        `;
        
        // Special handling for payments table (uses payment_date instead of created_at)
        if (table === 'payments') {
          query = `
            SELECT 
                '${table}' as table_name,
                COUNT(*) as total_rows,
                COUNT(DISTINCT school_id) as unique_schools,
                MAX(payment_date) as latest_record
            FROM ${table}
          `;
        }
        
        const statsResult = await pgPool.query(query);
        const stats = statsResult.rows[0];
        console.log(`\n📈 ${table.toUpperCase()} Statistics:`);
        console.log(`  Total Rows: ${stats.total_rows}`);
        console.log(`  Unique Schools: ${stats.unique_schools}`);
        console.log(`  Latest Record: ${stats.latest_record}`);
        
        // Check if table needs tenant-aware indexing
        if (stats.unique_schools > 1 && stats.total_rows > 1000) {
          console.log(`  ⚠️  REQUIRES: Composite tenant index for performance`);
        }
        
      } catch (error) {
        console.log(`\n❌ Could not analyze ${table}: ${error.message}`);
      }
    }

    // Check for missing critical indexes
    const missingIndexes = await pgPool.query(`
      SELECT 
          'Missing school_id + created_at index' as recommendation,
          tablename
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('students', 'payments', 'users', 'attendance', 'results', 'activity_logs')
      AND tablename NOT IN (
          SELECT DISTINCT tablename 
          FROM pg_indexes 
          WHERE indexdef LIKE '%school_id%' 
          AND indexdef LIKE '%created_at%'
      )
    `);

    if (missingIndexes.rows.length > 0) {
      console.log('\n⚠️  Missing Performance Indexes:');
      console.table(missingIndexes.rows);
    }

    // Analyze query performance patterns
    console.log('\n🎯 Performance Recommendations:');
    
    if (indexResult.rows.length < 10) {
      console.log('❌ INSUFFICIENT: Not enough tenant-aware indexes for scale');
    } else {
      console.log('✅ ADEQUATE: Good tenant-aware index coverage');
    }

    console.log('\n📋 Required Actions:');
    console.log('1. Ensure all tenant tables have (school_id, created_at) composite indexes');
    console.log('2. Add (school_id, status) indexes for high-traffic status queries');
    console.log('3. Monitor query performance as tenant count grows');
    console.log('4. Consider partitioning by school_id for very large tables');

  } catch (error) {
    console.error('❌ Performance analysis failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeDatabasePerformance()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { analyzeDatabasePerformance };
