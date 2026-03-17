import './src/config/env.js';
import { testSupabaseConnection } from './src/config/supabase.js';

testSupabaseConnection().then(result => {
  console.log('Supabase test result:', result);
  process.exit(0);
}).catch(error => {
  console.error('Supabase test failed:', error.message);
  process.exit(1);
});
