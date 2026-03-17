import pg from "pg";

const { Pool } = pg;

function buildPgConfigFromEnv() {
  const connectionString =
    process.env.PG_DATABASE_URL || process.env.DATABASE_URL || "";

  const sslEnabled = String(process.env.PG_SSL || "").toLowerCase() === "true";

  // Supabase commonly requires SSL. We keep it opt-in to avoid breaking local dev.
  const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined;

  if (connectionString) {
    return {
      connectionString,
      ssl,
      max: Number(process.env.PG_POOL_MAX || 10),
    };
  }

  return {
    host: process.env.PG_HOST || "127.0.0.1",
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "",
    database: process.env.PG_NAME || "postgres",
    ssl,
    max: Number(process.env.PG_POOL_MAX || 10),
  };
}

export const pgPool = new Pool(buildPgConfigFromEnv());

// Connection pool session reset to prevent tenant contamination
pgPool.on('connect', (client) => {
  // Reset session variables when connection is established
  client.query('SELECT reset_tenant_session()').catch(err => {
    console.warn('Failed to reset tenant session on connect:', err.message);
  });
});

pgPool.on('acquire', (client) => {
  // Reset session variables when connection is acquired from pool
  client.query('SELECT reset_tenant_session()').catch(err => {
    console.warn('Failed to reset tenant session on acquire:', err.message);
  });
});

export async function testPgConnection() {
  // Use Supabase client with service role key to bypass RLS for connection test
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY, // service_role key bypasses RLS
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );

  try {
    // Simple test query that doesn't hit RLS-protected tables
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('school_id')
      .limit(1);

    if (error) {
      throw new Error(`Supabase test failed: ${error.message}`);
    }
    
    console.log(`✅ Supabase test query succeeded (rows: ${data.length})`);
  } finally {
    // No need to manually close Supabase client
  }
}

