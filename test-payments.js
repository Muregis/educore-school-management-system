import fetch from 'node-fetch';

const supabaseUrl = 'https://slewmhaflrplgedgfvmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXdtaGFmbHJwbGdlZGdmdm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDUzMjAsImV4cCI6MjA4ODYyMTMyMH0.-x1RF6tliEzI0BLPoBqQ9BD_FRG2wdZUPFyL-ZbsegQ';
const supabaseToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc0MTg2MTg3LCJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBncmVlbmZpZWxkLmFjLmtlIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJjdXN0b20iLCJyb2xlIjoiYWRtaW4ifSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiTXJzLiBXYW5qaWt1Iiwic2Nob29sX2lkIjoxfSwic2Nob29sX2lkIjoxLCJpYXQiOjE3NzM1ODEzODd9.NgI-Mp0hzMXMNbGG_ZewSO_KknaMRuBBMlUQxnhK7Vo';

async function testPayments() {
  console.log('💰 Testing payments RLS...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/payments?select=*&limit=5`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseToken}`
      }
    });
    
    if (response.ok) {
      const payments = await response.json();
      console.log('✅ Payments returned:', payments.length);
      console.log('📋 Payment list:');
      payments.forEach(payment => {
        console.log(`  - ${payment.fee_type} $${payment.amount} (School ID: ${payment.school_id})`);
      });
      
      const otherSchoolPayments = payments.filter(p => p.school_id !== 1);
      if (otherSchoolPayments.length > 0) {
        console.log('❌ SECURITY ISSUE: Found payments from other schools!');
      } else {
        console.log('✅ RLS working: Only School 1 payments visible');
      }
    } else {
      console.error('❌ Error:', response.status);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testPayments();
