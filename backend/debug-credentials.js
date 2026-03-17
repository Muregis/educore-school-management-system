import './src/config/env.js';

console.log('=== DATABASE CREDENTIALS DEBUG ===');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('DATABASE_URL starts with postgresql:', process.env.DATABASE_URL?.startsWith('postgresql://') || false);

if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  // Parse the URL to show components (without revealing password)
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (match) {
    console.log('User:', match[1]);
    console.log('Password length:', match[2].length);
    console.log('Host:', match[3]);
    console.log('Port:', match[4]);
    console.log('Database:', match[5]);
  } else {
    console.log('URL format could not be parsed');
  }
}

console.log('=== SUPABASE CREDENTIALS ===');
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('SUPABASE_JWT_SECRET exists:', !!process.env.SUPABASE_JWT_SECRET);
