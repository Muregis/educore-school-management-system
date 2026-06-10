import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://slewmhaflrplgedgfvmz.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXdtaGFmbHJwbGdlZGdmdm16Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA0NTMyMCwiZXhwIjoyMDg4NjIxMzIwfQ.Iy6gDBmYRpo4l8RMdk0KWKx8ujjyGAaUVMzLWC-gaeg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testHrTables() {
  console.log('\n=== Testing HR Tables ===');
  
  const tables = ['hr_staff', 'hr_leave', 'hr_attendance', 'hr_payslips'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`✗ ${table}: ${error.message}`);
      } else {
        console.log(`✓ ${table}: Table exists and accessible`);
      }
    } catch (err) {
      console.log(`✗ ${table}: ${err.message}`);
    }
  }
}

async function testAnnouncementsTable() {
  console.log('\n=== Testing Announcements Table ===');
  
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`✗ announcements: ${error.message}`);
    } else {
      console.log(`✓ announcements: Table exists and accessible`);
    }
  } catch (err) {
    console.log(`✗ announcements: ${err.message}`);
  }
}

async function testDiscountValueType() {
  console.log('\n=== Testing Discount Value Type ===');
  
  try {
    const { data, error } = await supabase
      .from('student_discounts')
      .select('discount_value_type')
      .limit(1);
    
    if (error) {
      console.log(`✗ student_discounts.discount_value_type: ${error.message}`);
    } else {
      console.log(`✓ student_discounts.discount_value_type: Column exists`);
      if (data && data.length > 0) {
        console.log(`  Sample value: ${data[0].discount_value_type || 'NULL'}`);
      }
    }
  } catch (err) {
    console.log(`✗ student_discounts.discount_value_type: ${err.message}`);
  }
}

async function main() {
  console.log('Testing Educore fixes...');
  
  await testHrTables();
  await testAnnouncementsTable();
  await testDiscountValueType();
  
  console.log('\n=== Test Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
