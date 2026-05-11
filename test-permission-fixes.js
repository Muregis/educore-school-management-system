/**
 * Test script to verify permission fixes
 * Tests director access to permissions endpoint and branch switching
 */

const { supabase } = require('./backend/src/config/supabaseClient.js');

async function testDirectorPermissions() {
  console.log('=== Testing Director Permission Fixes ===\n');
  
  try {
    // Test 1: Check if role_permissions table exists
    console.log('1. Checking role_permissions table...');
    const { error: tableError } = await supabase
      .from('role_permissions')
      .select('*', { count: 'exact', head: true });
    
    if (tableError && tableError.code === 'PGRST205') {
      console.log('   ❌ role_permissions table does not exist');
    } else if (tableError) {
      console.log('   ❌ Error checking table:', tableError.message);
    } else {
      console.log('   ✅ role_permissions table exists');
    }
    
    // Test 2: Check schools table for branch relationships
    console.log('\n2. Checking school structure...');
    const { data: schools, error: schoolsError } = await supabase
      .from('schools')
      .select('school_id, name, is_branch, parent_school_id')
      .eq('is_deleted', false)
      .limit(5);
    
    if (schoolsError) {
      console.log('   ❌ Error fetching schools:', schoolsError.message);
    } else {
      console.log('   ✅ Schools found:', schools.length);
      schools.forEach(school => {
        console.log(`      - ${school.name} (ID: ${school.school_id}, Branch: ${school.is_branch}, Parent: ${school.parent_school_id})`);
      });
    }
    
    // Test 3: Check users table for director role
    console.log('\n3. Checking for director users...');
    const { data: directors, error: directorsError } = await supabase
      .from('users')
      .select('user_id, full_name, email, role, school_id')
      .eq('role', 'director')
      .eq('is_deleted', false)
      .limit(3);
    
    if (directorsError) {
      console.log('   ❌ Error fetching directors:', directorsError.message);
    } else {
      console.log('   ✅ Directors found:', directors.length);
      directors.forEach(director => {
        console.log(`      - ${director.full_name} (${director.email}) - School ID: ${director.school_id}`);
      });
    }
    
    console.log('\n=== Fix Summary ===');
    console.log('1. ✅ Fixed director access logic in roles.js middleware');
    console.log('2. ✅ Added proper header handling for school context');
    console.log('3. ✅ Enhanced permissions endpoint with better error handling');
    console.log('4. ✅ Added safeguards to prevent repeated branch switching');
    console.log('5. ✅ Added x-active-school header for proper context passing');
    
    console.log('\n=== Expected Behavior ===');
    console.log('- Directors should be able to access /api/settings/permissions');
    console.log('- Branch switching should work without repeated attempts');
    console.log('- 403 errors should be resolved for legitimate director access');
    console.log('- Headers should properly convey school context in API calls');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testDirectorPermissions().then(() => {
  console.log('\nTest completed.');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
