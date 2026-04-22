// EduCore Student Bulk Import Script - CSV + Excel Version
// Usage: node import-students-v2.js
// Place all 12 CSV files in a folder called 'import-data' next to this script

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

function excelDateToISO(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('-')) return val.split('T')[0];
  if (!isNaN(val)) {
    const date = new Date((Number(val) - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return null;
}

function formatPhone(phone) {
  if (!phone) return null;
  let p = String(phone).trim().replace(/\s+/g, '');
  if (p === '') return null;
  if (p.startsWith('+')) return p;
  if (p.startsWith('254')) return '+' + p;
  if (p.startsWith('07') || p.startsWith('01')) return '+254' + p.slice(1);
  if (p.length === 9) return '+254' + p;
  return p;
}

const classCache = {};

async function getOrCreateClass(className, schoolId) {
  if (!className) return null;
  const key = `${schoolId}-${className}`;
  if (classCache[key]) return classCache[key];

  const { data } = await supabase
    .from('classes')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('class_name', className)
    .maybeSingle();

  if (data) {
    classCache[key] = data.class_id;
    return data.class_id;
  }

  const { data: newClass, error } = await supabase
    .from('classes')
    .insert({ school_id: schoolId, class_name: className, academic_year: 2026 })
    .select('class_id')
    .single();

  if (error) {
    console.error(`Failed to create class ${className}:`, error.message);
    return null;
  }

  console.log(`  Created class: ${className}`);
  classCache[key] = newClass.class_id;
  return newClass.class_id;
}

async function importFile(filePath) {
  console.log(`\nImporting: ${path.basename(filePath)}`);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log(`Found ${rows.length} students`);

  let success = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const className = String(row['class_name'] || row['Class'] || row['class'] || '').trim();
    const admissionNumber = String(row['admission_number'] || row['Admission Number'] || row['Admission'] || '').trim();
    const firstName = String(row['first_name'] || row['First Name'] || row['Firstname'] || '').trim();
    const lastName = String(row['last_name'] || row['Last Name'] || row['Lastname'] || '').trim();

    if (!admissionNumber || !firstName || !lastName) {
      skipped++;
      continue;
    }

    const classId = className ? await getOrCreateClass(className, SCHOOL_ID) : null;

    const student = {
      school_id: SCHOOL_ID,
      class_id: classId,
      class_name: className || null,
      admission_number: admissionNumber,
      first_name: firstName,
      last_name: lastName,
      gender: String(row['gender'] || 'other').toLowerCase().trim(),
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

    const { error } = await supabase
      .from('students')
      .upsert(student, { onConflict: 'school_id,admission_number' });

    if (error) {
      console.error(`  FAILED: ${firstName} ${lastName} (${admissionNumber}) — ${error.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${firstName} ${lastName} (${admissionNumber})`);
      success++;
    }
  }

  console.log(`  Result: ${success} imported, ${skipped} skipped, ${failed} failed`);
  return { success, skipped, failed };
}

async function main() {
  const importDir = path.join(__dirname, 'import-data');

  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir);
    console.log('Created import-data folder. Drop your 12 CSV files there and run again.');
    return;
  }

  const files = fs.readdirSync(importDir)
    .filter(f => f.endsWith('.csv') || f.endsWith('.xlsx') || f.endsWith('.xls'))
    .map(f => path.join(importDir, f));

  if (files.length === 0) {
    console.log('No files found in import-data folder.');
    return;
  }

  console.log(`Found ${files.length} file(s) — School ID ${SCHOOL_ID} (Real Peak Education Centre)`);

  let total = { success: 0, skipped: 0, failed: 0 };

  for (const file of files) {
    const result = await importFile(file);
    total.success += result.success;
    total.skipped += result.skipped;
    total.failed += result.failed;
  }

  console.log(`\n✅ ALL DONE`);
  console.log(`Total imported: ${total.success}`);
  console.log(`Total skipped:  ${total.skipped}`);
  console.log(`Total failed:   ${total.failed}`);
}

main().catch(console.error);
