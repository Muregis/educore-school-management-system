import fetch from 'node-fetch';

async function testPaystackVerify() {
  console.log('🧪 Testing Paystack verify route...');
  
  try {
    // Test the route without authentication (should fail)
    const response = await fetch('http://localhost:4000/api/paystack/verify/test-ref-123');
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response:', text);
    
    if (response.status === 401) {
      console.log('✅ Correctly requires authentication');
    } else if (response.status === 500) {
      console.log('❌ Still getting 500 error - need to restart server');
    } else {
      console.log('🤔 Unexpected response code');
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testPaystackVerify().catch(console.error);
