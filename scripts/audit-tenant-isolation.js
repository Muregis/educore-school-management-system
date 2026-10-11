import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'backend', 'src', 'routes');

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let supabaseCalls = 0;
  let missingSchoolId = 0;
  let issues = [];

  // A very basic heuristic: we look for 'supabase.from('
  // Then we check the next few lines for 'school_id'
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('supabase.from(') || lines[i].includes('supabase\n') || lines[i].match(/supabase\s*\.\s*from/)) {
      supabaseCalls++;
      // check context window of 10 lines
      const context = lines.slice(i, i + 10).join(' ');
      if (!context.includes('school_id') && !context.includes('schoolId')) {
        // Exclude specific tables that don't have school_id or are globally accessed
        if (!context.includes('.from("users")') && !context.includes(".from('users')") &&
            !context.includes('.from("schools")') && !context.includes(".from('schools')")) {
          missingSchoolId++;
          issues.push(`Line ${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
  }
  return { file: path.basename(filePath), calls: supabaseCalls, missing: missingSchoolId, issues };
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (fullPath.endsWith('.js')) {
      results.push(scanFile(fullPath));
    }
  });
  return results;
}

const results = walk(routesDir);
let totalCalls = 0;
let totalMissing = 0;

results.forEach(res => {
  totalCalls += res.calls;
  totalMissing += res.missing;
  if (res.missing > 0) {
    console.log(`\n[WARNING] ${res.file}: ${res.missing} potential missing tenant filters`);
    res.issues.forEach(i => console.log(`  -> ${i}`));
  }
});

console.log(`\nAudit Complete: ${totalCalls} supabase calls, ${totalMissing} potentially missing school_id filter.`);
