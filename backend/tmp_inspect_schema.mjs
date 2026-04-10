import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function inspect() {
  const { supabase } = await import('./src/config/supabaseClient.js');
  const queries = [
    { table: 'subjects', select: '*', limit: 1 },
    { table: 'mpesa_unmatched', select: 'id', limit: 1 },
    { table: 'mpesa_reconciliation_logs', select: 'id', limit: 1 },
  ];

  for (const query of queries) {
    try {
      const { data, error, status } = await supabase
        .from(query.table)
        .select(query.select)
        .limit(query.limit);
      if (error) {
        console.error(query.table, 'ERROR', error.message, error.details || '', 'status', status);
      } else {
        console.log(query.table, 'OK', 'rows', data?.length, 'columns', data?.[0] ? Object.keys(data[0]).join(', ') : 'no rows');
      }
    } catch (err) {
      console.error(query.table, 'EXCEPTION', err.message);
    }
  }
}

inspect();
