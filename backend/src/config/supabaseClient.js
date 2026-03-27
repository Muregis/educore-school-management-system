import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_KEY || "").trim();

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-tenant-source': 'educore-backend'
    }
  }
});

export function withTenantFilter(query, schoolId) {
  return query.eq('school_id', schoolId);
}

export async function safeSupabaseQuery(queryFn, errorMessage = 'Database operation failed') {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.error('Supabase query error:', error);
      throw new Error(`${errorMessage}: ${error.message}`);
    }
    return { data, error: null };
  } catch (err) {
    console.error('Supabase operation error:', err);
    throw new Error(`${errorMessage}: ${err.message}`);
  }
}

export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: 'Supabase connection successful' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function executeTransaction(operations) {
  try {
    const { data, error } = await supabase.rpc('execute_transaction', { operations });
    if (error) throw new Error(`Transaction failed: ${error.message}`);
    return { success: true, data };
  } catch (err) {
    throw new Error(`Transaction failed: ${err.message}`);
  }
}

// Unified database interface
export const database = {
  async query(sqlOrTable, paramsOrOptions = []) {
    const isRawSQL = typeof sqlOrTable === 'string' && 
      (sqlOrTable.toUpperCase().includes('SELECT') || 
      sqlOrTable.toUpperCase().includes('INSERT') || 
      sqlOrTable.toUpperCase().includes('UPDATE') || 
      sqlOrTable.toUpperCase().includes('DELETE'));
    
    if (isRawSQL) {
      throw new Error(
        `Raw SQL queries are not supported. Use Supabase builder API (.from('table').select()) ` +
        `or create an RPC function. Query: ${sqlOrTable?.substring(0, 50)}...`
      );
    }

    // Structured query
    const options = paramsOrOptions;
    let query = supabase.from(sqlOrTable);

    // Apply select
    if (options.select) {
      query = query.select(options.select);
    } else {
      query = query.select('*');
    }

    // Apply tenant filtering if schoolId provided
    if (options.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    // Apply all where filters (including school_id if present in where)
    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        // FIX: Do NOT skip school_id from where - it may differ from options.schoolId
        // Only skip if already applied via options.schoolId to avoid duplicate
        if (key === 'school_id' && options.schoolId) continue;
        if (value !== null && value !== undefined) {
          if (typeof value === 'object' && value.gte !== undefined) {
            query = query.gte(key, value.gte);
          } else if (typeof value === 'object' && value.lte !== undefined) {
            query = query.lte(key, value.lte);
          } else {
            query = query.eq(key, value);
          }
        }
      }
    }

    // Apply ordering
    if (options.order) {
      if (typeof options.order === 'string') {
        query = query.order(options.order);
      } else if (options.order.column) {
        query = query.order(options.order.column, { ascending: options.order.ascending !== false });
      }
    }

    // Apply pagination
    if (options.limit) {
      if (options.offset) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      } else {
        query = query.limit(options.limit);
      }
    }

    return safeSupabaseQuery(() => query, `Query failed on table ${sqlOrTable}`);
  },

  async insert(table, data, options = {}) {
    let query = supabase.from(table).insert(data);
    if (options.select) {
      query = query.select(options.select);
    }
    return safeSupabaseQuery(() => query, `Insert failed on table ${table}`);
  },

  async update(table, data, where, options = {}) {
    let query = supabase.from(table).update(data);
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value);
      }
    }
    if (options.select) {
      query = query.select(options.select);
    }
    return safeSupabaseQuery(() => query, `Update failed on table ${table}`);
  },

  async delete(table, where, options = {}) {
    let query = supabase.from(table).delete();
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key, value);
      }
    }
    if (options.select) {
      query = query.select(options.select);
    }
    return safeSupabaseQuery(() => query, `Delete failed on table ${table}`);
  },

  async rpc(functionName, params = {}) {
    return safeSupabaseQuery(
      () => supabase.rpc(functionName, params),
      `RPC call failed for ${functionName}`
    );
  }
};

export default supabase;