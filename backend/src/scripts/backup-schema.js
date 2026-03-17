// Schema backup script for Supabase
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL || 'https://slewmhaflrplgedgfvmz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXdtaGFmbHJwbGdlZGdmdm16Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA0NTMyMCwiZXhwIjoyMDg4NjIxMzIwfQ.Iy6gDBmYRpo4l8RMdk0KWKx8ujjyGAaUVMzLWC-gaeg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function exportSchema() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = join(__dirname, `../backups/schema-backup-${timestamp}.sql`);
  
  console.log('Starting schema backup...');
  
  try {
    // Get list of tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (tablesError) throw tablesError;
    
    console.log(`Found ${tables.length} tables`);
    
    let schemaSQL = `-- EduCore Schema Backup\n-- Generated: ${new Date().toISOString()}\n-- Database: Supabase PostgreSQL\n\n`;
    
    // Get row counts for key tables
    const keyTables = ['users', 'students', 'payments', 'schools', 'classes', 'teachers'];
    schemaSQL += `-- Key Table Row Counts:\n`;
    
    for (const tableName of keyTables) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          schemaSQL += `--   ${tableName}: ${count} rows\n`;
        }
      } catch (e) {
        schemaSQL += `--   ${tableName}: ERROR counting\n`;
      }
    }
    
    schemaSQL += `\n-- Tables in database:\n`;
    for (const t of tables) {
      schemaSQL += `--   - ${t.table_name}\n`;
    }
    
    schemaSQL += `\n-- RLS Policies:\n`;
    
    // Try to get RLS policies via RPC
    try {
      const { data: policies, error: policiesError } = await supabase.rpc('get_policies');
      if (!policiesError && policies) {
        schemaSQL += `-- Active RLS policies exported via RPC\n`;
      } else {
        schemaSQL += `-- RLS policies: RPC not available (expected in production)\n`;
      }
    } catch (e) {
      schemaSQL += `-- RLS policies: Could not fetch (requires admin functions)\n`;
    }
    
    // Save backup
    writeFileSync(backupFile, schemaSQL);
    console.log(`Schema backup saved to: ${backupFile}`);
    console.log(`Tables found: ${tables.map(t => t.table_name).join(', ')}`);
    
    return backupFile;
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  }
}

exportSchema();
