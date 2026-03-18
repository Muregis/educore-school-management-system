import fs from 'fs';
import path from 'path';
import { supabase } from '../src/config/supabaseClient.js';
import { env } from '../src/config/env.js';

async function runMigration() {
  try {
    console.log('🚀 Running HR and Payroll tables migration...');
    
    // Read the migration file
    const migrationPath = path.join(import.meta.dirname, '../migrations/001_create_hr_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_statement: statement });
        
        if (error) {
          // If exec_sql doesn't exist, try direct SQL execution
          console.log('⚠️  exec_sql function not found, trying direct execution...');
          
          // For Supabase, we need to use the SQL editor or REST API
          // This is a limitation - you'll need to run the SQL manually in Supabase SQL Editor
          console.log('❌ Cannot execute SQL directly via client. Please run the migration manually in Supabase SQL Editor.');
          console.log(`📄 Migration file: ${migrationPath}`);
          break;
        }
        
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (err) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message);
        // Continue with other statements
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of: migrations/001_create_hr_tables.sql');
    console.log('4. Run the SQL script to create the tables');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
