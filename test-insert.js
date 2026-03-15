import fetch from 'node-fetch';

const supabaseUrl = 'https://slewmhaflrplgedgfvmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXdtaGFmbHJwbGdlZGdmdm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDUzMjAsImV4cCI6MjA4ODYyMTMyMH0.-x1RF6tliEzI0BLPoBqQ9BD_FRG2wdZUPFyL-ZbsegQ';
const supabaseToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc0MTg2MTg3LCJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBncmVlbmZpZWxkLmFjLmtlIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJjdXN0b20iLCJyb2xlIjoiYWRtaW4ifSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiTXJzLiBXYW5qaWt1Iiwic2Nob29sX2lkIjoxfSwic2Nob29sX2lkIjoxLCJpYXQiOjE3NzM1ODEzODd9.NgI-Mp0hzMXMNbGG_ZewSO_KknaMRuBBMlUQxnhK7Vo';

async function testInsert() {
  console.log('🔐 Testing INSERT policy...');
  
  try {
    // Test 1: Try to insert student for correct school (should succeed)
    const correctStudent = {
      admission_number: 'TEST-001',
      first_name: 'Test',
      last_name: 'Student',
      gender: 'male',
      school_id: 1, // Correct school
      class_name: 'Grade 1A',
      status: 'active'
    };
    
    const response1 = await fetch(`${supabaseUrl}/rest/v1/students`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(correctStudent)
    });
    
    console.log('✅ Insert for correct school:', response1.status, response1.ok ? 'SUCCESS' : 'FAILED');
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('   Created student:', data1.first_name, data1.last_name, '(School ID:', data1.school_id, ')');
    } else {
      const error1 = await response1.text();
      console.log('   Error:', error1);
    }
    
    // Test 2: Try to insert student for wrong school (should fail)
    const wrongStudent = {
      admission_number: 'TEST-002',
      first_name: 'Wrong',
      last_name: 'School',
      gender: 'female',
      school_id: 2, // Wrong school - should be blocked
      class_name: 'Grade 1A',
      status: 'active'
    };
    
    const response2 = await fetch(`${supabaseUrl}/rest/v1/students`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(wrongStudent)
    });
    
    console.log('❌ Insert for wrong school:', response2.status, response2.ok ? 'UNEXPECTED SUCCESS' : 'CORRECTLY BLOCKED');
    if (!response2.ok) {
      const error2 = await response2.text();
      console.log('   Error (expected):', error2);
    } else {
      console.log('   🚨 SECURITY BREACH: User was able to insert into wrong school!');
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testInsert();
