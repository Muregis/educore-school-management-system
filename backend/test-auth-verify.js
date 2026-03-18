import fetch from 'node-fetch';

async function testWithAuth() {
  console.log('🧪 Testing Paystack verify with authentication...');
  
  try {
    // First, let's try to login to get a token
    console.log('\n1. Attempting login...');
    const loginResponse = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@educore.com', // Common default admin email
        password: 'admin123'        // Common default password
      })
    });
    
    console.log('Login status:', loginResponse.status);
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (loginData.token) {
      console.log('\n2. Testing verify route with auth token...');
      const verifyResponse = await fetch('http://localhost:4000/api/paystack/verify/test-ref-123', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      });
      
      console.log('Verify status:', verifyResponse.status);
      const verifyData = await verifyResponse.json();
      console.log('Verify response:', verifyData);
      
      if (verifyResponse.status === 400 && verifyData.message === "Payment not successful") {
        console.log('✅ Route is working correctly (400 is expected for test reference)');
      } else if (verifyResponse.status === 404) {
        console.log('✅ Route is working correctly (404 is expected for test reference)');
      } else if (verifyResponse.status === 500) {
        console.log('❌ Still getting 500 error - investigate further');
      }
    } else {
      console.log('❌ Login failed, cannot test authenticated route');
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testWithAuth().catch(console.error);
