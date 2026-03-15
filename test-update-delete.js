import fetch from 'node-fetch';

const supabaseUrl = 'https://slewmhaflrplgedgfvmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXdtaGFmbHJwbGdlZGdmdm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDUzMjAsImV4cCI6MjA4ODYyMTMyMH0.-x1RF6tliEzI0BLPoBqQ9BD_FRG2wdZUPFyL-ZbsegQ';
const supabaseToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc0MTg2MTg3LCJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBncmVlbmZpZWxkLmFjLmtlIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJjdXN0b20iLCJyb2xlIjoiYWRtaW4ifSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiTXJzLiBXYW5qaWt1Iiwic2Nob29sX2lkIjoxfSwic2Nob29sX2lkIjoxLCJpYXQiOjE3NzM1ODEzODd9.NgI-Mp0hzMXMNbGG_ZewSO_KknaMRuBBMlUQxnhK7Vo';

async function testUpdateDelete() {
  console.log('🔐 Testing UPDATE and DELETE policies...');
  
  try {
    // First, let's get a student ID from School 1 to test with
    const getResponse = await fetch(`${supabaseUrl}/rest/v1/students?select=student_id&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseToken}`
      }
    });
    
    if (!getResponse.ok) {
      console.error('❌ Failed to get test student');
      return;
    }
    
    const students = await getResponse.json();
    const testStudentId = students[0]?.student_id;
    
    if (!testStudentId) {
      console.error('❌ No students found to test with');
      return;
    }
    
    console.log(`📋 Testing with student_id: ${testStudentId}`);
    
    // Test 1: UPDATE student in correct school (should succeed)
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/students?student_id=eq.${testStudentId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        first_name: 'Updated Name'
      })
    });
    
    console.log('✅ UPDATE correct school:', updateResponse.status, updateResponse.ok ? 'SUCCESS' : 'FAILED');
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.log('   Error:', error);
    }
    
    // Test 2: Try to UPDATE with wrong school_id (should fail)
    const updateWrongResponse = await fetch(`${supabaseUrl}/rest/v1/students?student_id=eq.${testStudentId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        first_name: 'Hacked Name',
        school_id: 2 // Try to change to wrong school
      })
    });
    
    console.log('❌ UPDATE wrong school_id:', updateWrongResponse.status, updateWrongResponse.ok ? 'UNEXPECTED SUCCESS' : 'CORRECTLY BLOCKED');
    if (!updateWrongResponse.ok) {
      const error = await updateWrongResponse.text();
      console.log('   Error (expected):', error);
    } else {
      console.log('   🚨 SECURITY BREACH: User was able to change school_id!');
    }
    
    // Test 3: DELETE student from correct school (should succeed)
    const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/students?student_id=eq.${testStudentId}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseToken}`,
        'Prefer': 'return=representation'
      }
    });
    
    console.log('✅ DELETE correct school:', deleteResponse.status, deleteResponse.ok ? 'SUCCESS' : 'FAILED');
    if (!deleteResponse.ok) {
      const error = await deleteResponse.text();
      console.log('   Error:', error);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testUpdateDelete();
