import fetch from 'node-fetch';

const supabaseUrl = 'https://slewmhaflrplgedgfvmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXdtaGFmbHJwbGdlZGdmdm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDUzMjAsImV4cCI6MjA4ODYyMTMyMH0.-x1RF6tliEzI0BLPoBqQ9BD_FRG2wdZUPFyL-ZbsegQ';
const supabaseToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc0MTg2MTg3LCJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBncmVlbmZpZWxkLmFjLmtlIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJjdXN0b20iLCJyb2xlIjoiYWRtaW4ifSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiTXJzLiBXYW5qaWt1Iiwic2Nob29sX2lkIjoxfSwic2Nob29sX2lkIjoxLCJpYXQiOjE3NzM1ODEzODd9.NgI-Mp0hzMXMNbGG_ZewSO_KknaMRuBBMlUQxnhK7Vo';

async function testDirectRest() {
  console.log('🔐 Testing RLS with direct REST API...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/students?select=*`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success! Students returned:', data.length);
      console.log('📋 Student list:');
      data.forEach(student => {
        console.log(`  - ${student.first_name} ${student.last_name} (School ID: ${student.school_id})`);
      });
      
      const otherSchoolStudents = data.filter(s => s.school_id !== 1);
      if (otherSchoolStudents.length > 0) {
        console.log('❌ SECURITY ISSUE: Found students from other schools!');
      } else {
        console.log('✅ RLS working: Only School 1 students visible');
      }
    } else {
      console.error('❌ Error:', response.status, data);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testDirectRest();
