import fetch from 'node-fetch';

async function testLogin() {
  try {
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

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    if (response.ok && data.token) {
      console.log('✅ LOGIN SUCCESSFUL with MySQL');
      console.log('User:', data.user);
    } else {
      console.log('❌ LOGIN FAILED');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();
