#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/db.js';
import { pgPool } from '../src/config/pg.js';

// Migration runner for PostgreSQL
const MIGRATIONS_DIR = path.join(process.cwd(), 'database', 'migrations');

async function runMigrations() {
  console.log('🚀 Starting EduCore database migrations...');
  
  try {
    // Create migrations tracking table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get executed migrations
    const { rows: executed } = await pgPool.query(
      'SELECT migration_name FROM schema_migrations ORDER BY migration_name'
    );
    const executedSet = new Set(executed.map(r => r.migration_name));
    
    // Get all migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`📁 Found ${migrationFiles.length} migration files`);
    
    for (const file of migrationFiles) {
      if (executedSet.has(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }
      
      console.log(`🔄 Running ${file}...`);
      
      // Read and execute migration
      const migrationPath = path.join(MIGRATIONS_DIR, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Start transaction
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        
        // Execute migration
        await client.query(migrationSQL);
        
        // Record migration
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
        
        await client.query('COMMIT');
        console.log(`✅ ${file} executed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ ${file} failed:`, error.message);
        throw error;
      } finally {
        client.release();
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
    
    // Show current schema status
    const { rows: currentMigrations } = await pgPool.query(
      'SELECT migration_name, executed_at FROM schema_migrations ORDER BY executed_at'
    );
    
    console.log('\n📊 Current migration status:');
    currentMigrations.forEach(m => {
      console.log(`   ${m.migration_name} - ${m.executed_at.toISOString()}`);
    });
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };
