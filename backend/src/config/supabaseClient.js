import { createClient } from '@supabase/supabase-js';
import { logTenantQuery } from "../helpers/tenant-debug.logger.js";

const cleanEnv = (val) => (val || "").trim().replace(/^['"]|['"]$/g, '').replace(/^false\s+/i, '');

const supabaseUrl = cleanEnv(process.env.SUPABASE_URL);
const supabaseServiceKey = cleanEnv(process.env.SUPABASE_SERVICE_KEY);
const supabaseAnonKey = cleanEnv(process.env.SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
}

// DEBUG: Final check to identify why Render is failing
console.log(`[Supabase] URL: length=${supabaseUrl.length}, startsWithHttp=${supabaseUrl.toLowerCase().startsWith('http')}`);
console.log(`[Supabase] Keys: ServiceKey_len=${supabaseServiceKey.length}, AnonKey_len=${supabaseAnonKey.length}`);
if (supabaseServiceKey.length > 0 && !supabaseServiceKey.startsWith('sb_') && !supabaseServiceKey.startsWith('eyJ')) {
  console.error(`[Supabase] CRITICAL: Service Key format looks invalid! Prefix: "${supabaseServiceKey.substring(0, 10)}..."`);
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
    logTenantQuery("database.query", {
      table: sqlOrTable,
      select: options.select || "*",
      schoolId: options.schoolId || options.where?.school_id || null,
      whereKeys: Object.keys(options.where || {}),
      order: options.order || null,
      limit: options.limit || null,
      offset: options.offset || null,
    });
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
    const schoolIds = Array.isArray(data)
      ? Array.from(new Set(data.map(item => item?.school_id).filter(Boolean)))
      : [data?.school_id].filter(Boolean);
    logTenantQuery("database.insert", { table, schoolIds, rows: Array.isArray(data) ? data.length : 1 });

    let query = supabase.from(table).insert(data);
    if (options.select) {
      query = query.select(options.select);
    }
    return safeSupabaseQuery(() => query, `Insert failed on table ${table}`);
  },

  async update(table, data, where, options = {}) {
    logTenantQuery("database.update", {
      table,
      schoolId: where?.school_id || null,
      whereKeys: Object.keys(where || {}),
      updateKeys: Object.keys(data || {}),
    });
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
    logTenantQuery("database.delete", {
      table,
      schoolId: where?.school_id || null,
      whereKeys: Object.keys(where || {}),
    });
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
    logTenantQuery("database.rpc", { functionName, schoolId: params?.p_school_id || params?.school_id || null });
    return safeSupabaseQuery(
      () => supabase.rpc(functionName, params),
      `RPC call failed for ${functionName}`
    );
  }
};

export default supabase;
