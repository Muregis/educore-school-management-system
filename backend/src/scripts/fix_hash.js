import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function update() {
  const email = process.env.DIRECTOR_EMAIL || process.env.TARGET_EMAIL;
  if (!email) {
    console.error('Error: DIRECTOR_EMAIL or TARGET_EMAIL environment variable is required');
    process.exit(1);
  }
  
  const hash = '$2a$10$OBZemTPWtQsOqJi5GmlYr.D40j8DW.AyaA9z.YSodOWeD8Ew/Kuwi';
  
  const { data, error } = await supabase
    .from('users')
    .update({ 
      password_hash: hash,
      status: 'active',
      is_deleted: false 
    })
    .ilike('email', email);
    
  if (error) console.error('Error:', error.message);
  else console.log(`Password hash updated successfully for ${email}.`);
}

update();
