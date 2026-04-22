import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkData() {
  const tables = [
    'schools', 'users', 'students', 'teachers', 'classes', 'subjects', 
    'attendance', 'results', 'payments', 'invoices', 'hr_staff'
  ];
  
  console.log('--- DATA STATUS FOR SCHOOL ID 2 ---');
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('school_id', 2);
      
      if (error) console.log(`${table}: Error - ${error.message}`);
      else console.log(`${table}: ${count} rows found`);
    } catch (e) {
      console.log(`${table}: Failed to query ${table}`);
    }
  }
}

checkData();
