// Run this with: node ../database/generate_password_hash.js from backend directory
import bcrypt from 'bcryptjs';

async function generateHash(password) {
  const hash = await bcrypt.hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
}

await generateHash('Director123');
await generateHash('Admin123');
