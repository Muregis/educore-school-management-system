import fetch from 'node-fetch';

async function getToken() {
  const response = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@greenfield.ac.ke',
      password: 'admin123',
      schoolId: 1
    })
  });
  
  const data = await response.json();
  console.log('Supabase Token:', data.supabaseToken);
  return data.supabaseToken;
}

getToken();
