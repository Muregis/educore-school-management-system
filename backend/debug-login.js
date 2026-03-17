import fetch from 'node-fetch';

async function testLoginWithDebug() {
  try {
    console.log('🔍 Testing login with debug...');
    
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@greenfield.ac.ke',
        password: 'admin123',
        schoolId: 1
      })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response text:', text);
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('✅ LOGIN SUCCESSFUL with MySQL');
      console.log('User:', data.user);
    } else {
      console.log('❌ LOGIN FAILED');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLoginWithDebug();
