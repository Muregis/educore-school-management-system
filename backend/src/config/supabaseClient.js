import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
// OLD: import { agentLog } from "../utils/agentDebugLog.js";

// Supabase configuration validation
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // #region agent log
  // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'pre-fix',hypothesisId:'H2',location:'backend/src/config/supabaseClient.js:12',message:'Missing Supabase env',data:{hasUrl:Boolean(supabaseUrl),hasServiceKey:Boolean(supabaseServiceKey)},timestamp:Date.now()})}).catch(()=>{});
  // OLD: agentLog({sessionId:"cdda91",runId:"pre-fix",hypothesisId:"H2",location:"backend/src/config/supabaseClient.js:12",message:"Missing Supabase env",data:{hasUrl:Boolean(supabaseUrl),hasServiceKey:Boolean(supabaseServiceKey)},timestamp:Date.now()});
  // #endregion
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
}

// Create Supabase client with optimal settings for backend use
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

// Helper function to enforce tenant isolation in all queries
export function withTenantFilter(query, schoolId) {
  return query.eq('school_id', schoolId);
}

// Helper function for safe Supabase queries with error handling
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

// Test connection function
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, message: 'Supabase connection successful' };
  } catch (err) {
    console.error('Supabase connection error:', err.message);
    return { success: false, error: err.message };
  }
}

// Transaction support using RPC calls
export async function executeTransaction(operations) {
  try {
    const { data, error } = await supabase.rpc('execute_transaction', {
      operations: operations
    });
    
    if (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('Transaction error:', err);
    throw new Error(`Transaction failed: ${err.message}`);
  }
}

// Export a unified database interface that matches the old pool interface
export const database = {
  // Query method that handles both raw SQL and structured queries
  async query(sqlOrTable, paramsOrOptions = []) {
    // Check if first parameter is a raw SQL query (contains SQL keywords)
    const isRawSQL = typeof sqlOrTable === 'string' && 
      (sqlOrTable.toUpperCase().includes('SELECT') || 
       sqlOrTable.toUpperCase().includes('INSERT') || 
       sqlOrTable.toUpperCase().includes('UPDATE') || 
       sqlOrTable.toUpperCase().includes('DELETE'));
    
    // #region agent log
    // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'pre-fix',hypothesisId:'H3',location:'backend/src/config/supabaseClient.js:110',message:'database.query called',data:{argType:typeof sqlOrTable,isRawSQL,tableOrSqlPreview:typeof sqlOrTable==='string'?sqlOrTable.slice(0,80):null,optionsType:Array.isArray(paramsOrOptions)?'array':'object',hasSchoolId:!!(paramsOrOptions&&paramsOrOptions.schoolId)},timestamp:Date.now()})}.catch(()=>{});
    // OLD: agentLog({sessionId:"cdda91",runId:"pre-fix",hypothesisId:"H3",location:"backend/src/config/supabaseClient.js:110",message:"database.query called",data:{argType:typeof sqlOrTable,isRawSQL,tableOrSqlPreview:typeof sqlOrTable==="string"?sqlOrTable.slice(0,80):null,optionsType:Array.isArray(paramsOrOptions)?"array":"object",hasSchoolId:!!(paramsOrOptions&&paramsOrOptions.schoolId)},timestamp:Date.now()});
    // #endregion

    if (isRawSQL) {
      // OLD: MySQL fallback - REMOVED. All queries must now use Supabase builder API
      // OLD: const mysql = await import('mysql2/promise');
      // OLD: const env = await import('./env.js');
      // OLD: const mysqlPool = mysql.createPool({...});
      // OLD: console.log('🔄 Falling back to MySQL for raw SQL query:', sqlOrTable.substring(0, 50) + '...');
      // OLD: const [rows] = await mysqlPool.execute(sqlOrTable, paramsOrOptions);
      // OLD: await mysqlPool.end();
      // OLD: return { data: rows, error: null };
      
      // NEW: Raw SQL no longer supported - use Supabase RPC for complex queries
      throw new Error(
        `Raw SQL queries are no longer supported. ` +
        `Use Supabase builder API (.from('table').select()) or create an RPC function. ` +
        `Query: ${sqlOrTable?.substring(0, 50)}...`
      );
    } else {
      // Handle structured query (original logic)
      let query = supabase.from(sqlOrTable);
      const options = paramsOrOptions;
      
      // Apply tenant filtering if schoolId is provided
      if (options.schoolId) {
        // #region agent log
        // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'pre-fix',hypothesisId:'H4',location:'backend/src/config/supabaseClient.js:156',message:'database.query applying tenant filter',data:{table:sqlOrTable,schoolId:options.schoolId},timestamp:Date.now()})}).catch(()=>{});
        // OLD: agentLog({sessionId:"cdda91",runId:"pre-fix",hypothesisId:"H4",location:"backend/src/config/supabaseClient.js:156",message:"database.query applying tenant filter",data:{table:sqlOrTable,schoolId:options.schoolId},timestamp:Date.now()});
        // #endregion
        query = withTenantFilter(query, options.schoolId);
      }
      
      // Apply select
      if (options.select) {
        query = query.select(options.select);
      } else {
        query = query.select('*');
      }
      
      // Apply filters
      if (options.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          if (key !== 'school_id') { // school_id already handled
            query = query.eq(key, value);
          }
        });
      }
      
      // Apply ordering
      if (options.order) {
        if (typeof options.order === 'string') {
          query = query.order(options.order);
        } else {
          const { column, ascending = true } = options.order;
          query = query.order(column, { ascending });
        }
      }
      
      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      // Apply offset
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }
      
      return safeSupabaseQuery(() => query, `Query failed on table ${sqlOrTable}`);
    }
  },
  
  // Insert method
  async insert(table, data, options = {}) {
    let query = supabase.from(table).insert(data);
    
    if (options.select) {
      query = query.select(options.select);
    }
    
    return safeSupabaseQuery(() => query, `Insert failed on table ${table}`);
  },
  
  // Update method
  async update(table, data, where, options = {}) {
    let query = supabase.from(table).update(data);
    
    // Apply where conditions
    if (where) {
      Object.entries(where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    if (options.select) {
      query = query.select(options.select);
    }
    
    return safeSupabaseQuery(() => query, `Update failed on table ${table}`);
  },
  
  // Delete method
  async delete(table, where, options = {}) {
    let query = supabase.from(table).delete();
    
    // Apply where conditions
    if (where) {
      Object.entries(where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    if (options.select) {
      query = query.select(options.select);
    }
    
    return safeSupabaseQuery(() => query, `Delete failed on table ${table}`);
  },
  
  // Raw SQL execution (for complex queries)
  async rpc(functionName, params = {}) {
    return safeSupabaseQuery(() => supabase.rpc(functionName, params), `RPC call failed for ${functionName}`);
  }
};

// Export the supabase client directly for advanced usage
export default supabase;
