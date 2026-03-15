import { pgPool } from '../config/pg.js';

async function checkActivityLogsSchema() {
  try {
    const result = await pgPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'activity_logs' 
      ORDER BY ordinal_position
    `);
    
    console.log('Activity Logs Columns:');
    console.table(result.rows);
    
    // Also check results and student_ledger
    const resultsResult = await pgPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'results' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nResults Columns:');
    console.table(resultsResult.rows);
    
    const ledgerResult = await pgPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'student_ledger' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nStudent Ledger Columns:');
    console.table(ledgerResult.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkActivityLogsSchema();
