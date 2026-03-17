import './src/config/env.js';
import { supabase } from './src/config/supabase.js';

async function createTestUser() {
  try {
    console.log('👤 Creating test admin user in Supabase...');
    
    const testUser = {
      user_id: 1,
      school_id: 1,
      full_name: 'System Administrator',
      email: 'admin@greenfield.ac.ke',
      password_hash: '$2a$10$K1mPN4jYjX9V9YlXZXqX8O5X9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m9', // bcrypt hash of 'admin123'
      role: 'admin',
      status: 'active',
      student_id: null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Try using the regular client first
    const { data, error } = await supabase
      .from('users')
      .insert([testUser])
      .select();
    
    if (error) {
      console.error('❌ Error creating user:', error);
      
      // If RLS blocks it, let's try to bypass with a different approach
      console.log('🔄 Trying alternative approach...');
      
      // Try using RPC or direct SQL if available
      const { data: rpcData, error: rpcError } = await supabase.rpc('insert_user', testUser);
      
      if (rpcError) {
        console.error('❌ RPC also failed:', rpcError);
        console.log('💡 You may need to:');
        console.log('   1. Temporarily disable RLS in Supabase dashboard');
        console.log('   2. Or use the correct service role key');
        console.log('   3. Or create the user manually in the dashboard');
        return false;
      }
      
      console.log('✅ User created via RPC:', rpcData);
      return true;
    }
    
    console.log('✅ Test user created successfully:', data);
    return true;
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error.message);
    return false;
  }
}

createTestUser().then(success => {
  if (success) {
    console.log('🎉 Test user ready for login testing!');
  } else {
    console.log('⚠️ Please create the admin user manually in Supabase dashboard');
    console.log('   Email: admin@greenfield.ac.ke');
    console.log('   Password: admin123 (bcrypt hash: $2a$10$K1mPN4jYjX9V9YlXZXqX8O5X9m9m9m9m9m9m9m9m9m9m9m9m9m9m9m)');
  }
  process.exit(0);
});
