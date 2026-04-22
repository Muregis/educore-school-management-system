// EduCore Student Bulk Import Script
// Usage: node import-students.js
// Place all student Excel files in a folder called 'import-data' next to this script

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================
// CONFIGURE THESE
// ==============================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SCHOOL_ID = 3; // Real Peak Education Centre
// ==============================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function excelDateToISO(excelDate) {
  if (!excelDate || isNaN(excelDate)) return null;
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

function formatPhone(phone) {
  if (!phone) return null;
  let p = String(phone).trim().replace(/\s+/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('254')) return '+' + p;
  if (p.startsWith('07') || p.startsWith('01')) return '+254' + p.slice(1);
  if (p.length === 9) return '+254' + p;
  return p;
}

async function getOrCreateClass(className, schoolId) {
  if (!className) return null;
  
  const { data, error } = await supabase
    .from('classes')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('class_name', className)
    .maybeSingle();

  if (data) return data.class_id;

  const { data: newClass, error: createError } = await supabase
    .from('classes')
    .insert({ school_id: schoolId, class_name: className, academic_year: 2026 })
    .select('class_id')
    .single();

  if (createError) {
    console.error(`Failed to create class ${className}:`, createError.message);
    return null;
  }

  console.log(`Created class: ${className}`);
  return newClass.class_id;
}

async function importFile(filePath) {
  console.log(`\nImporting: ${path.basename(filePath)}`);
  
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${rows.length} students`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const className = row['class_name'] || row['Class'] || row['class'];
    const classId = await getOrCreateClass(className, SCHOOL_ID);

    const student = {
      school_id: SCHOOL_ID,
      class_id: classId,
      class_name: className,
      admission_number: String(row['admission_number'] || row['Admission Number'] || '').trim(),
      first_name: String(row['first_name'] || row['First Name'] || '').trim(),
      last_name: String(row['last_name'] || row['Last Name'] || '').trim(),
      gender: String(row['gender'] || '').toLowerCase().trim() || 'other',
      date_of_birth: excelDateToISO(row['date_of_birth'] || row['Date of Birth']),
      parent_name: row['parent_name'] || row['Parent Name'] || null,
      parent_phone: formatPhone(row['parent_phone'] || row['Parent Phone']),
      status: row['status'] || 'active',
      nemis_number: row['nemis_number'] || null,
      blood_group: row['blood_group'] || 'Unknown',
      allergies: row['allergies'] || 'None',
      medical_conditions: row['medical_conditions'] || 'None',
      emergency_contact_name: row['emergency_contact_name'] || null,
      emergency_contact_phone: formatPhone(row['emergency_contact_phone']),
      emergency_contact_relationship: row['emergency_contact_relationship'] || null,
    };

    if (!student.admission_number || !student.first_name || !student.last_name) {
      console.log(`  Skipping incomplete row: ${JSON.stringify(row)}`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('students')
      .upsert(student, { onConflict: 'school_id,admission_number', ignoreDuplicates: false });

    if (error) {
      console.error(`  FAILED: ${student.first_name} ${student.last_name} (${student.admission_number}) — ${error.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${student.first_name} ${student.last_name} (${student.admission_number})`);
      success++;
    }
  }

  console.log(`\nDone: ${success} imported, ${skipped} skipped, ${failed} failed`);
}

async function main() {
  const importDir = path.join(__dirname, 'import-data');
  
  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir);
    console.log('Created import-data folder. Place your Excel files there and run again.');
    return;
  }

  const files = fs.readdirSync(importDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  
  if (files.length === 0) {
    console.log('No Excel files found in import-data folder.');
    return;
  }

  console.log(`Found ${files.length} file(s) to import for School ID: ${SCHOOL_ID}`);

  for (const file of files) {
    await importFile(path.join(importDir, file));
  }

  console.log('\n✅ All files processed.');
}

main().catch(console.error);
