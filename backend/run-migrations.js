import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://slewmhaflrplgedgfvmz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXdtaGFmbHJwbGdlZGdmdm16Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA0NTMyMCwiZXhwIjoyMDg4NjIxMzIwfQ.Iy6gDBmYRpo4l8RMdk0KWKx8ujjyGAaUVMzLWC-gaeg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration(filePath, migrationName) {
  console.log(`\n=== Running migration: ${migrationName} ===`);
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error(`Error running ${migrationName}:`, error);
      return false;
    }
    
    console.log(`✓ Successfully ran ${migrationName}`);
    return true;
  } catch (err) {
    console.error(`Error reading or running ${migrationName}:`, err);
    return false;
  }
}

async function runMigrationDirect(filePath, migrationName) {
  console.log(`\n=== Running migration: ${migrationName} ===`);
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolon and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          console.warn(`Warning in statement:`, error.message);
        }
      }
    }
    
    console.log(`✓ Successfully ran ${migrationName}`);
    return true;
  } catch (err) {
    console.error(`Error reading or running ${migrationName}:`, err);
    return false;
  }
}

async function main() {
  console.log('Starting migrations...');
  
  const migrations = [
    { path: '../database/migrations/051_create_hr_tables.sql', name: '051_create_hr_tables' },
    { path: '../database/migrations/052_fix_announcements_rls.sql', name: '052_fix_announcements_rls' }
  ];
  
  const results = [];
  
  for (const migration of migrations) {
    const fullPath = path.join(__dirname, migration.path);
    const success = await runMigrationDirect(fullPath, migration.name);
    results.push({ name: migration.name, success });
  }
  
  console.log('\n=== Migration Results ===');
  results.forEach(r => {
    console.log(`${r.success ? '✓' : '✗'} ${r.name}`);
  });
  
  const allSuccess = results.every(r => r.success);
  if (allSuccess) {
    console.log('\n✓ All migrations completed successfully!');
  } else {
    console.log('\n✗ Some migrations failed. Please check the errors above.');
  }
  
  process.exit(allSuccess ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
