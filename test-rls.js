import { createClient } from '@supabase/supabase-js';

// Test RLS policy for students table
const supabaseUrl = 'https://slewmhaflrplgedgfvmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXdtaGFmbHJwbGdlZGdmdm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDUzMjAsImV4cCI6MjA4ODYyMTMyMH0.-x1RF6tliEzI0BLPoBqQ9BD_FRG2wdZUPFyL-ZbsegQ';

// Use supabaseToken from your new login response
const supabaseToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc0MTg1NDczLCJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBncmVlbmZpZWxkLmFjLmtlIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJjdXN0b20iLCJyb2xlIjoiYWRtaW4ifSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiTXJzLiBXYW5qaWt1Iiwic2Nob29sX2lkIjoxfSwic2Nob29sX2lkIjoxLCJpYXQiOjE3NzM1ODA2NzN9.DLYY57aJ3UpcZQ044szjEtd60JETsbwQC_FF4irtTDA';

async function testRls() {
  console.log('🔐 Testing RLS with School 1 admin token...');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Set the session with our custom JWT
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: supabaseToken,
    refresh_token: '' // No refresh token for custom JWT
  });
  
  if (sessionError) {
    console.error('❌ Session error:', sessionError);
    return;
  }
  
  console.log('✅ Session set successfully');

  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('*');
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('✅ Students returned:', students.length);
    console.log('📋 Student list:');
    students.forEach(student => {
      console.log(`  - ${student.first_name} ${student.last_name} (School ID: ${student.school_id})`);
    });
    
    // Check if all students are from school 1
    const otherSchoolStudents = students.filter(s => s.school_id !== 1);
    if (otherSchoolStudents.length > 0) {
      console.log('❌ SECURITY ISSUE: Found students from other schools!');
    } else {
      console.log('✅ RLS working: Only School 1 students visible');
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testRls();
