import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Database Migrations & Schema Reproducibility', () => {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');

  it('verifies migrations directory exists and has files', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
  });

  it('verifies sequential ordering and no duplicate migration numbers', () => {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    const numbers = files.map(f => {
      const match = f.match(/^(\d{3})_/);
      return match ? parseInt(match[1], 10) : null;
    }).filter(n => n !== null);

    // Assert every number is unique
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(numbers.length);

    // Assert numbering starts at 1 and has no random negative or non-sequential gaps
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(sorted[0]).toBe(1);
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i]).toBe(i + 1);
    }
  });

  it('verifies all migration files contain valid DDL without naked DROP TABLE', () => {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

    files.forEach(file => {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      // Migration files must not be empty
      expect(content.trim().length).toBeGreaterThan(0);

      // Migrations must not contain unqualified "DROP TABLE <table>;" without IF EXISTS
      const unsafeDrop = /DROP\s+TABLE\s+(?!IF\s+EXISTS)/i.test(content);
      expect(unsafeDrop).toBe(false);
    });
  });

  it('verifies core database tables exist in baseline schema definitions', () => {
    const rootDbDir = path.resolve(process.cwd(), '../database');
    if (fs.existsSync(rootDbDir)) {
      const schemaFiles = ['schema.sql', 'supabase_schema.sql', 'create_all_tables.sql'];
      const foundSchemas = schemaFiles
        .map(f => path.join(rootDbDir, f))
        .filter(p => fs.existsSync(p));

      expect(foundSchemas.length).toBeGreaterThan(0);

      const combinedSchema = foundSchemas
        .map(p => fs.readFileSync(p, 'utf-8'))
        .join('\n');

      const requiredTables = ['schools', 'users', 'students', 'classes'];
      requiredTables.forEach(table => {
        const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?(public\\.)?${table}\\b`, 'i');
        expect(tableRegex.test(combinedSchema)).toBe(true);
      });
    }
  });
});
