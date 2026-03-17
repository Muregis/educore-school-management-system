import './src/config/env.js';
import { createClient } from '@supabase/supabase-js';

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAdminUser() {
  try {
    // Disable RLS temporarily
    console.log('🔓 Disabling RLS...');
    await supabaseAdmin.rpc('sql', { 
      query: 'ALTER TABLE users DISABLE ROW LEVEL SECURITY;' 
    });
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([{
        user_id: 1,
        school_id: 1,
        full_name: 'System Administrator',
        email: 'admin@greenfield.ac.ke',
        password_hash: '$2a$10$K1mPN4jYjX9V9YlXZXqX8O5X9m9m9m9m9m9m9m9m9m9m9m9m',
        role: 'admin',
        status: 'active',
        student_id: null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Admin user created:', data);
    }
    
    // Re-enable RLS
    console.log('🔒 Re-enabling RLS...');
    await supabaseAdmin.rpc('sql', { 
      query: 'ALTER TABLE users ENABLE ROW LEVEL SECURITY;' 
    });
    
    console.log('🎉 Done!');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

createAdminUser();
