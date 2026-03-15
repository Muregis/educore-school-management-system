import { pgPool } from '../config/pg.js';

// Enhanced connection pool configuration for multi-tenant safety
export const enhancedPgPoolConfig = {
  // Base configuration
  ...pgPool.options,
  
  // Multi-tenant safety configurations
  connectionTimeoutMillis: 30000,        // 30 second connection timeout
  idleTimeoutMillis: 30000,              // 30 second idle timeout
  max: 20,                               // Increased for multi-tenant workload
  
  // Tenant isolation settings
  statement_timeout: 30000,              // 30 second query timeout
  query_timeout: 30000,                   // 30 second query timeout
  
  // Connection retry settings
  retries: 3,
  retryDelayMillis: 2000,
};

// Enhanced session reset with comprehensive cleanup
export async function resetTenantSessionEnhanced(client) {
  try {
    // Reset all tenant-specific session variables
    await client.query('SELECT reset_tenant_session()');
    
    // Additional safety checks
    await client.query('SET search_path TO public');
    await client.query('RESET ALL');
    
    return true;
  } catch (error) {
    console.warn('Enhanced session reset failed:', error.message);
    return false;
  }
}

// Connection pool safety monitoring
export class ConnectionPoolMonitor {
  static async getPoolStats() {
    try {
      const result = await pgPool.query('SELECT * FROM connection_pool_stats');
      return result.rows[0];
    } catch (error) {
      console.error('Failed to get pool stats:', error.message);
      return null;
    }
  }
  
  static async getHealthCheck() {
    try {
      const result = await pgPool.query('SELECT * FROM connection_pool_health_check()');
      return result.rows;
    } catch (error) {
      console.error('Failed to get health check:', error.message);
      return [];
    }
  }
  
  static async validateTenantContext(schoolId) {
    try {
      const result = await pgPool.query('SELECT validate_tenant_context($1)', [schoolId]);
      return result.rows[0].validate_tenant_context;
    } catch (error) {
      console.error('Tenant context validation failed:', error.message);
      return false;
    }
  }
}

// Enhanced connection pool with safety middleware
export function setupConnectionPoolSafety() {
  console.log('🔒 Setting up connection pool safety...');
  
  // Enhanced connect handler
  pgPool.on('connect', async (client) => {
    const success = await resetTenantSessionEnhanced(client);
    if (!success) {
      console.warn('Session reset failed on connect - potential tenant contamination risk');
    }
  });
  
  // Enhanced acquire handler
  pgPool.on('acquire', async (client) => {
    const success = await resetTenantSessionEnhanced(client);
    if (!success) {
      console.warn('Session reset failed on acquire - potential tenant contamination risk');
    }
  });
  
  // Add error handling for connection failures
  pgPool.on('error', (err) => {
    console.error('Connection pool error:', err.message);
    if (err.code === 'ECONNRESET') {
      console.warn('Connection reset - tenant context may be contaminated');
    }
  });
  
  // Add remove handler for cleanup
  pgPool.on('remove', (client) => {
    console.log('Connection removed from pool');
  });
  
  console.log('✅ Connection pool safety setup complete');
}

// Tenant context validation middleware
export function validateTenantContextMiddleware(schoolId) {
  return async (req, res, next) => {
    try {
      const isValid = await ConnectionPoolMonitor.validateTenantContext(schoolId);
      if (!isValid) {
        return res.status(403).json({ 
          error: 'Tenant context validation failed',
          code: 'TENANT_CONTEXT_INVALID'
        });
      }
      next();
    } catch (error) {
      console.error('Tenant context validation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Export for use in main application
export { resetTenantSessionEnhanced };
