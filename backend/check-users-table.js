import './src/config/env.js';
import { supabase } from './src/config/supabase.js';

async function checkUsersTable() {
  try {
    console.log('Checking if users table exists in Supabase...');
    
    // Try to select from users table
    const { data, error } = await supabase
      .from('users')
      .select('user_id, email, role')
      .limit(1);
    
    if (error) {
      console.error('Error accessing users table:', error);
      return;
    }
    
    console.log('✅ Users table exists');
    console.log('Sample users:', data);
    
    // Check total count
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    console.log('Total users count:', count);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkUsersTable();
