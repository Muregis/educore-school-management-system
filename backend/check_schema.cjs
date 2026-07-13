const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

(async () => {
  const { data: studs } = await supabase.from('students').select('student_id, id').limit(5);
  console.log('Sample id values:');
  studs?.forEach(s => console.log('  student_id:', s.student_id, '-> id:', s.id));

  const { data: nullIds } = await supabase.from('students').select('student_id').is('id', null).limit(1);
  console.log('Students with null id:', nullIds?.length || 0);

  const { data: all } = await supabase.from('students').select('student_id, id').eq('is_deleted', false).limit(500);
  const uuids = all?.filter(s => String(s.id).includes('-')) || [];
  const nums = all?.filter(s => !String(s.id).includes('-')) || [];
  console.log('Total students checked:', all?.length);
  console.log('Students with UUID id:', uuids.length);
  console.log('Students with non-UUID id:', nums.length);
  console.log('Unique id count:', new Set(all?.map(s => s.id)).size);
  console.log('Unique student_id count:', new Set(all?.map(s => s.student_id)).size);
})();
